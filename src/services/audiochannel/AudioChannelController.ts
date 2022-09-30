import { createItem, updateItem } from '../../controllers/GQL';
import {
  redisSetChannelInfo,
  redisDelWithPrefix,
  redisSetChunk,
} from '../../utils/RedisUtil';
import { emptyS3Directory } from '../../utils/AWSUtil';
import { writeM3uManifest } from '../../utils/HlsUtil';
import {
  channelObjectToChannelInfo,
  channelExists,
} from '../../utils/AudioChannelUtil';
import {
  getChannelHlsChunks,
  sortChannelChunks,
  syncChannelStatusToDatabase,
} from './helpers/StreamingHelper';
import { AudioBuffer, HlsChunk, AudioChunk } from '../../ts/types/audioTypes';
import { StatusResult } from '../../ts/types/resultTypes';
import { AudioChannel, MongoId } from '../../ts/types/contentTypes';

export const requestChannel = async (storyId: MongoId, sampleRate: number) => {
  const channel: AudioChannel = await createItem(
    'AudioChannel',
    {
      story: {
        connect: { id: storyId },
      },
      sampleRate,
    },
    `id
    story {
      id
    }
    sampleRate
    inputChannels
    duration
    chunks`
  );

  await redisSetChannelInfo(
    `${channel.id}`,
    JSON.stringify(channelObjectToChannelInfo(channel))
  );
  return channel.id;
};

export const clearChannel = async (
  channelId: MongoId
): Promise<StatusResult> => {
  // is the specified channel provisioned?
  const channelExistsResponse = await channelExists(channelId);
  const chanExists = channelExistsResponse[0];
  const channelInfo = channelExistsResponse[1];

  if (!chanExists) {
    return {
      error: true,
      message: `channel ${channelId} not acceptable`,
      status: 406,
    };
  }

  // delete pcm chunks from redis and s3 mp3 chunks
  // clear out the redis channelinfo
  // for good measure, synch channel to db also
  const { chunks: oldChunks } = channelInfo;
  channelInfo.chunks = [];
  channelInfo.audioDuration = 0;

  // array of promises to clear redis pcm chunks
  const redisPromises = oldChunks.map(chunkInfo =>
    redisDelWithPrefix('chunk', chunkInfo.chunkId)
  );

  // promise to clear out s3 mp3 chunks
  const s3Promise = emptyS3Directory(
    process.env.OPERATIONAL_BUCKET,
    `stream/${channelId}`
  );

  // db update promise
  const dbPromise = updateItem(
    'AudioChannel',
    channelId,
    {
      duration: '0',
      chunks: JSON.stringify([]),
    },
    'id'
  );

  // TODO: error handling
  await Promise.all([
    redisSetChannelInfo(`${channelId}`, JSON.stringify(channelInfo)),
    ...redisPromises,
    s3Promise,
    dbPromise,
  ]);

  return {
    error: false,
    status: 200,
  };
};

export const upstreamHLS = async (
  channelId: MongoId,
  _chunk: AudioBuffer,
  chunkId: string,
  syncToDB: boolean,
  chunkMap: string[]
): Promise<StatusResult> => {
  // is the specified channel provisioned?

  const channelExistsResponse = await channelExists(channelId);
  const chanExists = channelExistsResponse[0];
  const channelInfo = channelExistsResponse[1];

  if (!chanExists) {
    return {
      error: true,
      message: `channel ${channelId} not acceptable`,
      status: 406,
    };
  }

  if (syncToDB) sortChannelChunks(channelInfo, chunkMap);

  // Add the unprocessed chunk to chunkinfo
  const chunkInfo: AudioChunk = new AudioChunk(chunkId, 0);
  channelInfo.chunks.push(chunkInfo);

  const promisesToResolve: Promise<unknown>[] = [
    redisSetChannelInfo(`${channelId}`, JSON.stringify(channelInfo)), // save channel info updated with new duration
    redisSetChunk(`${chunkId}`, Buffer.from([..._chunk.data])), // save the chunk as uploaded for processing purposes
  ];

  // CU-2d2rx5v aiming to delete this once tested
  if (syncToDB) promisesToResolve.push(syncChannelStatusToDatabase(channelId));

  await Promise.all(promisesToResolve);
  return {
    error: false,
    status: 200,
  };
};

export const downstreamChannel = async (
  channelId: MongoId,
  writeStream
): Promise<StatusResult> => {
  try {
    const hlsChunks: HlsChunk[] = await getChannelHlsChunks(channelId);
    writeM3uManifest(hlsChunks, writeStream);
    return {
      error: false,
      status: 200,
    };
  } catch (err) {
    return {
      error: true,
      message: `channel ${channelId} not acceptable`,
      status: 406,
    };
  }
};
