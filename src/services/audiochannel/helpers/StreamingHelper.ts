import { MongoId } from '../../../ts/types/contentTypes';
import {
  ChannelInfo,
  HlsChunk,
  AudioChunk,
} from '../../../ts/types/audioTypes';
import { Readable } from 'stream';
import { s3UploadStreamPromise, getPresignedUrl } from '../../../utils/AWSUtil';
import { redisSetChannelInfo } from '../../../utils/RedisUtil';
import { getMp3TransformStreams } from '../../../utils/AudioUtil';
import { updateItem } from '../../../controllers/GQL';
import {
  channelExists,
  channelIdToChannelInfo,
} from '../../../utils/AudioChannelUtil';

export const uploadChunkBufferToS3Promise = (
  channelId: MongoId,
  chunkId: string,
  chunkBuffer: Buffer,
  sampleRate: number,
  inputChannels: number
): Promise<unknown> => {
  const chunkStream = Readable.from(chunkBuffer);
  const { s3WriteStream, s3WritePromise } = s3UploadStreamPromise(
    process.env.OPERATIONAL_BUCKET,
    `${channelId}/${chunkId}.mp3`,
    'stream'
  );
  const [pcmWriteStream, mp3TransformStream] = getMp3TransformStreams(
    sampleRate,
    inputChannels
  );
  mp3TransformStream.pipe(s3WriteStream);
  chunkStream.pipe(pcmWriteStream);

  return s3WritePromise;
};

export const syncChannelStatusToDatabase = async (
  channelId: MongoId
): Promise<unknown> => {
  const channelExistsResponse = await channelExists(channelId);
  const channelInfo = channelExistsResponse[1];

  return updateItem(
    'AudioChannel',
    channelId,
    {
      chunks: JSON.stringify(channelInfo.chunks),
      duration: channelInfo.audioDuration.toString(),
    },
    `id`
  );
};

export const sortChannelChunks = (
  channelInfo: ChannelInfo,
  chunkMap: string[]
) => {
  // sort channel info chunks into the order specified by chunkmap
  // for chunks not present in chunkmap, assume they are already correctly sorted
  channelInfo.chunks.sort((a: AudioChunk, b: AudioChunk) => {
    return chunkMap.indexOf(a.chunkId) - chunkMap.indexOf(b.chunkId);
  });
};

export const getChannelHlsChunks = async (
  channelId: MongoId
): Promise<HlsChunk[]> => {
  let channelInfo: ChannelInfo;

  // is the specified channel provisioned?
  const channelExistsResponse = await channelExists(channelId);
  const chanExists = channelExistsResponse[0];
  const cachedChannelInfo = channelExistsResponse[1];

  if (!chanExists) {
    // channel info has been expired from redis, so grab from db and re-cache to redis
    channelInfo = await channelIdToChannelInfo(channelId);
    await redisSetChannelInfo(channelId, JSON.stringify(channelInfo));
  } else channelInfo = cachedChannelInfo;

  const chunks = channelInfo.chunks;

  if (!chunks || chunks.length < 1) {
    throw `channel ${channelId} not acceptable`;
  }

  return Promise.all(
    chunks.map(async chunk => {
      return {
        url: await getPresignedUrl(
          `${channelId}/${chunk.chunkId}.mp3`,
          'stream',
          process.env.OPERATIONAL_BUCKET
        ),
        duration: chunk.duration,
      };
    })
  );
};
