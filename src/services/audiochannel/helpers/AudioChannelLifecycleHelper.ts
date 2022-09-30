import moment from 'moment';
import { AudioChannel, MongoId } from "../../../ts/types/contentTypes";
import { getItem, getItems } from '../../../controllers/GQL';
import {
    terminateChannel,
  } from '../../../utils/AudioChannelUtil';
import { AudioChunk } from "../../../ts/types/audioTypes";
import { DeclutterArchivePolicy, AudioChannelStatus } from '../../../ts/types/contentTypes';
import { objectExistsInS3Bucket } from '../../../utils/AWSUtil';
import { s3UploadChannelChunksPromise } from '../../../utils/AudioChannelUtil';

// Terminates and deletes channels associated with the story
// Any archiving should be done before calling this
// TODO: ALL-378 improve error handling where terminate channels is unable to find channel info on Redis
export const terminateStoryChannels = async (storyId: MongoId) => {
    try {
      const allStoryChannels: AudioChannel[] = await getItems(
        'AudioChannel',
        {
          story: {
            id: storyId,
          },
        },
        `id
      status
      chunks`
      );
  
      await Promise.all(
        allStoryChannels.map(channel =>
          terminateChannel(channel.id, AudioChannelStatus.DELETED, channel.status, channel.chunks)
        )
      );
    } catch (err) {
      console.error('terminateStoryChannels ', err);
    }
  };
  
// check that each chunk that has been uploaded is available as a downstreamable file in the s3 stream folder
// any chunks that are not available get re-created
// returns accumulated boolean true (all chunks are there) or false (one or more chunks missing and unable to repair)
export const auditChannelIntegrity = async (channelId: MongoId): Promise<boolean> => {
    try {
      const channel: AudioChannel = await getItem(
        'AudioChannel',
        channelId,
        `id
        status
        chunks`
      );
      const chunks: AudioChunk[] = JSON.parse(channel.chunks);
      const checkResults: boolean[] = await Promise.all(
        chunks.map(async chunk => {
          const chunkOnS3 = await objectExistsInS3Bucket(
            process.env.OPERATIONAL_BUCKET,
            `stream/${channelId}/${chunk.chunkId}.mp3`
          );
          if (!chunkOnS3) {
            try {

              console.warn('Need serverless task implementation for uploadChunkBufferToS3Promise');
              // CU-2hxer7r migrate this to serverless bc it requires ffmpeg
              // const promiseAllResponse: [ChannelInfo, number[]] = await Promise.all([
              //   redisGetChannelInfo(channelId),
              //   redisGetChunk(chunk.chunkId),
              // ]);
              // const channelInfo = promiseAllResponse[0];
              // const chunkBuffer = promiseAllResponse[1];
              // await uploadChunkBufferToS3Promise(
              //   channelId,
              //   chunk.chunkId,
              //   Buffer.from([...chunkBuffer]),
              //   channelInfo.sampleRate,
              //   channelInfo.inputChannels
              // );
              return true;
            } catch (err) {
              console.warn(`Channel id ${channelId} failed audit channel integrity check for chunk ${chunk.chunkId}
              and failed to recreate chunk with error ${err}`);
              return false;
            }
          } else return true;
        })
      );
      const accumulatedResult = checkResults.reduce(
        (accBool, thisResult) => accBool && thisResult,
        true
      );
      return accumulatedResult;
    } catch (err) {
      console.error(`auditChannelIntegrity encountered error ${err}`);
      return false;
    }
  };
  
// go through channels that the db thinks is still recording
// and delete any that are aged
// for deleted channels, apply the archiving policy (either 'ARCHIVE' or 'DELETE')
export const cleanupAudioChannels = async (
    cleanupAge: number,
    declutterArchivePolicy = DeclutterArchivePolicy.DELETE,
    cleanupTimepoint = ''
  ) => {
    try {
      console.log('cleanupAudioChannels()');
      const channels: AudioChannel[] = await getItems(
        'AudioChannel',
        {
          status: AudioChannelStatus.RECORDING,
          story: {
            OR: [{ status_not: AudioChannelStatus.RECORDING }, { status_not: AudioChannelStatus.SAVED }],
          },
        },
        `id
        updatedAt
        status
        chunks`
      );
      const cleanupTimepointMoment = cleanupTimepoint
        ? moment(cleanupTimepoint)
        : moment();
      for (const channel of channels) {
        const updatedAtMoment = moment(channel.updatedAt);
        const channelAge = Math.abs(
          updatedAtMoment.diff(cleanupTimepointMoment, 'hours', false)
        );
        // terminate if idle for longer than the cleanup age
        if (channelAge > cleanupAge) {
          console.log(
            'channel ',
            channel.id,
            ' unused for more than ',
            cleanupAge,
            ' hours, terminating with archive policy ',
            declutterArchivePolicy
          );
          if (declutterArchivePolicy === DeclutterArchivePolicy.ARCHIVE)
            await s3UploadChannelChunksPromise(
              channel.id,
              JSON.parse(channel.chunks)
            );
          await terminateChannel(
            channel.id,
            AudioChannelStatus.DELETED,
            channel.status,
            channel.chunks
          );
        }
      }
    } catch (err) {
      console.error('cleanupChannels ', err);
    }
  };
  
  