import { updateItem, getItem, getItems, createItem } from '../controllers/GQL';
import {
  redisDelWithPrefix,
  redisSetChannelInfo,
  redisGetChannelInfo,
  redisGetChunk,
} from './RedisUtil';
import { s3UploadStreamPromise, emptyS3Directory } from './AWSUtil';
import { Readable } from 'stream';
import { pcmToMp3Stream } from './AudioUtil';
import {
  AudioChannel,
  MongoId,
  AudioChannelStatus,
  StoryMetadata,
  MediaAsset,
} from '../ts/types/contentTypes';
import { AudioChunk, ChannelInfo } from '../ts/types/audioTypes';
const { OPERATIONAL_BUCKET } = process.env;

export const channelObjectToChannelInfo = (
  channelObject: AudioChannel
): ChannelInfo => {
  return {
    channelId: channelObject.id,
    storyId: channelObject.story.id,
    sampleRate: channelObject.sampleRate,
    inputChannels: channelObject.inputChannels,
    audioDuration: parseFloat(channelObject.duration),
    chunks: JSON.parse(channelObject.chunks),
  };
};

export const s3UploadChannelChunksPromise = async (
  channelId: MongoId,
  chunks: AudioChunk[],
  mediaFolder = 'archived',
  deleteFromRedis = false
): Promise<void> => {
  try {
    await Promise.all(
      chunks.map(async chunk => {
        const { s3WriteStream, s3WritePromise } = s3UploadStreamPromise(
          OPERATIONAL_BUCKET,
          `${channelId}/${chunk.chunkId}`,
          mediaFolder,
          'application/x-binary'
        );
        let chunkData: number[];
        try {
          chunkData = await redisGetChunk(chunk.chunkId);
        } catch (err) {
          console.warn(
            's3UploadChannelChunksPromise unable to locate chunk ',
            chunk.chunkId,
            ' on redis'
          );
          chunkData = [];
        }
        const readStream = Readable.from(Buffer.from([...chunkData]));
        readStream.on('end', () => {
          readStream.destroy();
        });
        readStream.on('error', err => {
          console.error('s3UploadChannelChunksPromise ', err);
          readStream.destroy();
        });
        readStream.pipe(s3WriteStream);
        const promisesToResolve = [s3WritePromise];
        if (deleteFromRedis)
          promisesToResolve.push(
            <Promise<any>>redisDelWithPrefix('chunk', chunk.chunkId)
          );
        return Promise.all(promisesToResolve);
      })
    );
  } catch (err) {
    console.error('s3UploadChannelChunksPromise ', err);
  }
};

// update channel status to the new value supplied
// removes all audio artefacts in redis,
// deletes saved info if channel was saved
// deletes stream info unless channel is being saved
// if available, use redis chunks, otherwise use db chunks
export const terminateChannel = async (
  channelId: MongoId,
  newChannelStatus = 'DELETED',
  dbStatus = '',
  dbChunks = ''
): Promise<unknown> => {
  const allPromises: Promise<unknown>[] = [];
  const channelInfo: ChannelInfo = await redisGetChannelInfo(`${channelId}`);
  const chanExists = channelInfo !== null;

  if (!chanExists) {
    // if no channel info in redis,
    // use dbchunks if supplied as a fallback
    if (dbChunks) {
      const chunks: AudioChunk[] = JSON.parse(dbChunks);
      const redisPromises: Promise<unknown>[] = chunks.map(chunkInfo =>
        redisDelWithPrefix('chunk', chunkInfo.chunkId)
      );
      allPromises.push(...redisPromises);
    }
    allPromises.push(
      updateItem(
        'AudioChannel',
        channelId,
        {
          status: newChannelStatus,
        },
        'id'
      )
    );
  } else {
    allPromises.push(
      <Promise<unknown>>redisDelWithPrefix('channelinfo', channelId)
    );
    const redisPromises = channelInfo.chunks.map(chunkInfo =>
      redisDelWithPrefix('chunk', chunkInfo.chunkId)
    );
    allPromises.push(...redisPromises);
    allPromises.push(
      updateItem(
        'AudioChannel',
        channelId,
        {
          duration: channelInfo.audioDuration.toString(10),
          chunks: JSON.stringify(channelInfo.chunks),
          status: newChannelStatus,
        },
        'id'
      )
    );
  }

  if (dbStatus === AudioChannelStatus.SAVED)
    allPromises.push(
      emptyS3Directory(OPERATIONAL_BUCKET, `saved/${channelId}`)
    );

  // delete the stream info if channel is not being saved
  if (newChannelStatus !== AudioChannelStatus.SAVED)
    allPromises.push(
      emptyS3Directory(OPERATIONAL_BUCKET, `stream/${channelId}`)
    );

  return Promise.all(allPromises);
};

// for the referenced story, it examines audio channel usage
// and returns three arrays of channel ids, usedChannels, unusedChannels, invalidChannels
// caller can supply metadata in object form to save one db call
export const extractUsedChannelIds = async function (
  storyId: MongoId,
  _metadata: StoryMetadata = null
): Promise<MongoId[][]> {
  let metadata: StoryMetadata;
  // if no metadata supplied, extract it from db
  if (!_metadata) {
    const storyObject = await getItem(
      'Story',
      storyId,
      `id
        metadata`
    );
    metadata = JSON.parse(storyObject.metadata);
  } else metadata = _metadata;

  // deleted channels are ignored, so only recording, saved, or published channels are considered
  const allStoryChannels: AudioChannel[] = await getItems(
    'AudioChannel',
    {
      story: {
        id: storyId,
      },
      status_not: 'DELETED',
    },
    'id'
  );

  const unusedChannels = allStoryChannels.map(channel => channel.id);
  const usedChannels: MongoId[] = [],
    invalidChannels: MongoId[] = [];

  if (metadata && metadata.responses) {
    const { responses } = metadata;
    for (const response of responses) {
      if (response.channelId) {
        // check the channel referenced in the metadata is valid
        if (
          unusedChannels.filter(channelId => channelId === response.channelId)
            .length > 0
        ) {
          usedChannels.push(response.channelId);
          const index = unusedChannels.indexOf(response.channelId);
          if (index > -1) {
            unusedChannels.splice(index, 1);
          }
        } else invalidChannels.push(response.channelId);
      }
    }
  }
  metadata = null; // avoid memleak
  return [[...usedChannels], [...unusedChannels], [...invalidChannels]]; // avoid memleak
};

export const updateDBChannelStatus = async (
  channelId: MongoId,
  newChannelStatus: AudioChannelStatus,
  writeToRedis = false,
  deleteFromRedis = false
): Promise<AudioChannel> => {
  const updatedChannel: AudioChannel = await updateItem(
    'AudioChannel',
    channelId,
    {
      status: newChannelStatus,
    },
    `id
      sampleRate
      status
      inputChannels
      duration
      chunks`
  );
  if (writeToRedis) {
    await redisSetChannelInfo(
      channelId,
      JSON.stringify(<ChannelInfo>{
        chunks: JSON.parse(updatedChannel.chunks),
        audioDuration: parseFloat(updatedChannel.duration),
        sampleRate: updatedChannel.sampleRate,
        inputChannels: updatedChannel.inputChannels,
      })
    );
  }
  if (deleteFromRedis) {
    await redisDelWithPrefix('channelinfo', channelId);
  }
  return updatedChannel;
};

export const storeAudioChannelAsMediaAsset = async (
  channelId: MongoId
): Promise<void> => {
  try {
    const channel: AudioChannel = await getItem(
      'AudioChannel',
      channelId,
      `id
        duration
        sampleRate
        inputChannels
        chunks`
    );

    const mediaAsset: MediaAsset = await createItem(
      'MediaAsset',
      {
        identifier: `Audio created from channel ${channelId}`,
        type: 'STORY_RESPONSE_AUDIO',
        duration: channel.duration,
      },
      `id
        s3key`
    );
    // pipe convert chunks to mp3 and upload to s3
    const chunks: AudioChunk[] = JSON.parse(channel.chunks);
    const { s3WriteStream, s3WritePromise } = s3UploadStreamPromise(
      OPERATIONAL_BUCKET,
      `${mediaAsset.s3key}`
    );
    const mp3WriteStream = pcmToMp3Stream(
      s3WriteStream,
      channel.sampleRate,
      channel.inputChannels
    );

    for (const chunk of chunks) {
      const chunkData: number[] = await redisGetChunk(chunk.chunkId);
      mp3WriteStream.write(Buffer.from([...chunkData]));
    }

    mp3WriteStream.end();

    // update channel object in db
    const dbPromise: Promise<AudioChannel> = await updateItem(
      'AudioChannel',
      channelId,
      {
        audioFile: {
          connect: {
            id: mediaAsset.s3key,
          },
        },
      },
      'id'
    );

    await Promise.all([s3WritePromise, dbPromise]);
  } catch (err) {
    console.error(
      'storeAudioChannelAsMediaAsset error for channel ',
      channelId,
      err
    );
  }
};

export const channelIdToChannelInfo = async (
  channelId: MongoId
): Promise<ChannelInfo> => {
  const channel: AudioChannel = await getItem(
    'AudioChannel',
    channelId,
    `id
      story {
        id
      }
      sampleRate
      inputChannels
      duration
      chunks`
  );
  return channelObjectToChannelInfo(channel);
};

export const channelDownstreamUrl = (audioChannelId: MongoId): string => {
  return `${process.env.VERSION_BASE_ROUTE}/audiochannel/downstream/channel/${audioChannelId}`;
};
export const channelExists = async (
  channelId: MongoId
): Promise<[boolean, ChannelInfo]> => {
  const channelInfo = await redisGetChannelInfo(`${channelId}`);
  return [channelInfo !== null, channelInfo];
};
