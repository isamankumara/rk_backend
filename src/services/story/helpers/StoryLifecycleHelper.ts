import moment from 'moment';
import {
  AudioChannel,
  AudioChannelStatus,
  MongoId,
  Story,
  StoryStatus,
  DeclutterArchivePolicy,
} from '../../../ts/types/contentTypes';
import { AudioChunk } from '../../../ts/types/audioTypes';
import {
  updateDBChannelStatus,
  s3UploadChannelChunksPromise,
  terminateChannel,
} from '../../../utils/AudioChannelUtil';
import {
  s3GetObjectReadStream,
  s3DeleteObjectPromise,
} from '../../../utils/AWSUtil';
import { pipeReadStreamToRedisPromise } from '../../../utils/RedisUtil';
import { getItem, getItems, updateItem } from '../../../controllers/GQL';

export async function restoreStoryChannels(restoreChannels: AudioChannel[]) {
  // set channels to recording and reinstate into redis
  // download saved chunks into redis
  // delete the chunk from s3
  await Promise.all(
    restoreChannels.map(async (channel: AudioChannel) => {
      await updateDBChannelStatus(
        channel.id,
        AudioChannelStatus.RECORDING,
        true
      );
      try {
        await Promise.all(
          JSON.parse(channel.chunks).map(async (chunk: AudioChunk) => {
            const chunkReadStream = s3GetObjectReadStream(
              process.env.OPERATIONAL_BUCKET,
              `${channel.id}/${chunk.chunkId}`,
              'saved'
            );
            await pipeReadStreamToRedisPromise(
              chunkReadStream,
              'chunk',
              chunk.chunkId
            );
            return s3DeleteObjectPromise(
              process.env.OPERATIONAL_BUCKET,
              `${channel.id}/${chunk.chunkId}`,
              'saved'
            );
          })
        );
      } catch (err) {
        console.error(
          'Unable to restore archived pcm chunks for channel ',
          channel.id,
          err
        );
      }
    })
  );
}

// checks for stories that are being recorded and appear to be abandoned
// where abandonded, stories are deleted or archived according to the declutter archive policy
// note: it is expected that the client should pick this up and force a delete or save
// to avoid this scenario
export async function cleanupRecordingStories(
  cleanupAge: number,
  declutterArchivePolicy = DeclutterArchivePolicy.DELETE,
  cleanupTimepoint = ''
) {
  try {
    console.log('cleanupRecordingStories()');
    const recordingStories: Story[] = await getItems(
      'Story',
      {
        status: StoryStatus.RECORDING,
      },
      `id
      updatedAt
      audioChannels {
        id
        chunks
        status
        updatedAt
      }`
    );

    const cleanupTimepointMoment = cleanupTimepoint
      ? moment(cleanupTimepoint)
      : moment();
    for (const story of recordingStories) {
      // calculate hours since last activity
      let hoursSinceLastActivity;
      if (story.audioChannels.length > 0)
        hoursSinceLastActivity = story.audioChannels.reduce(
          (youngestChannelAge, channel) => {
            try {
              const updatedAtMoment = moment(channel.updatedAt);
              const channelAge: number = Math.abs(
                updatedAtMoment.diff(cleanupTimepointMoment, 'hours', false)
              );
              return (channel.status !== AudioChannelStatus.DELETED && (channelAge < youngestChannelAge))
                ? channelAge
                : youngestChannelAge;
            } catch (err) {
              return youngestChannelAge;
            }
          },
          9999999
        );
      else {
        const updatedAtMoment = moment(story.updatedAt);
        hoursSinceLastActivity = Math.abs(
          updatedAtMoment.diff(cleanupTimepointMoment, 'hours', false)
        );
      }
      // only cleanup if youngest channel is older than cleanup age
      if (hoursSinceLastActivity > cleanupAge) {
        console.log(
          'story ',
          story.id,
          ' no recording activity for more than ',
          cleanupAge,
          ' hours, deleting with archive policy ',
          declutterArchivePolicy
        );
        await Promise.all(
          story.audioChannels.map(async channel => {
            if (declutterArchivePolicy === DeclutterArchivePolicy.ARCHIVE)
              await s3UploadChannelChunksPromise(
                channel.id,
                JSON.parse(channel.chunks)
              );
            if (channel.status !== AudioChannelStatus.DELETED)
              await terminateChannel(
                channel.id,
                AudioChannelStatus.DELETED,
                channel.status,
                channel.chunks
              );
          })
        );
        await updateItem(
          'Story',
          story.id,
          {
            status: StoryStatus.DELETED,
          },
          'id'
        );
      }
    }
  } catch (err) {
    console.error('cleanupStories encountered error ', err);
  }
}

export async function deleteAssociatedArtefacts(storyId: MongoId) {
  // delete mp3 artefacts in s3
  // if unfinalised, delete channel artefacts
  // if finalised, delete archived artefacts
  const story: Story = await getItem(
    'Story',
    storyId,
    `id
    status
    audioFile {
      s3key
    }
    audioChannels {
      id
      status
      chunks
      audioFile {
        s3key
      }
    }`
  );

  switch (story.status) {
    case StoryStatus.PUBLISHED:
      await Promise.all(
        story.audioChannels.map(async channel => {
          await terminateChannel(
            channel.id,
            AudioChannelStatus.DELETED,
            channel.status,
            channel.chunks
          );
        })
      );
      break;
    case StoryStatus.PUBLISHED_FINALISED:
      await Promise.all([
        ...story.audioChannels.map(
          (audioChannel: AudioChannel): Promise<unknown> => {
            return Promise.all([
              audioChannel.audioFile
                ? s3DeleteObjectPromise(
                    process.env.OPERATIONAL_BUCKET,
                    audioChannel.audioFile.s3key,
                    'media'
                  )
                : null,
              terminateChannel(
                audioChannel.id,
                AudioChannelStatus.DELETED,
                audioChannel.status,
                audioChannel.chunks
              ),
            ]);
          }
        ),
        s3DeleteObjectPromise(
          process.env.OPERATIONAL_BUCKET,
          story.audioFile.s3key,
          'media'
        ),
      ]);
      break;
  }
}
