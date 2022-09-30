import { Response } from 'express';
import {
  getItem,
  createItem,
  getItems,
  updateItem,
  one2ManyGQLExpand,
} from '../../controllers/GQL';
import { sendSystemEventEmail } from '../../controllers/emailApi';
import { getTracks, sendStoryHlsManifest } from './helpers/StoryAudioHelper';
import {
  redisGetStoryTracks,
  redisSetStoryTracks,
  redisDelWithPrefix,
} from '../../utils/RedisUtil';
import {
  extractUsedChannelIds,
  updateDBChannelStatus,
  s3UploadChannelChunksPromise,
  terminateChannel,
} from '../../utils/AudioChannelUtil';
import { packageTopicForPlayback } from '../topic/TopicController';
import {
  restoreStoryChannels,
  deleteAssociatedArtefacts,
} from './helpers/StoryLifecycleHelper';
import {
  AudioChannel,
  AudioChannelStatus,
  MongoId,
  PublishStoryData,
  Story,
  StoryStatus,
  StoryMetadata,
  TopicMetadata,
  MediaAsset,
  AudioChannelSampleRate,
} from '../../ts/types/contentTypes';
import { AudioChunk, Track } from '../../ts/types/audioTypes';
import {
  auditChannelIntegrity,
  terminateStoryChannels,
} from '../../services/audiochannel/helpers/AudioChannelLifecycleHelper';

// Fragments
import {
  storyTracksReturnFragment,
  storyReturnFragment,
} from '../../fragments/storyFragment';
import { interviewerReturnFragment } from '../../fragments/interviewerFragment';

export const getStoryTracks = async (
  storyId: MongoId
): Promise<Array<Track>> => {
  // look in redis cache
  const cachedTracks: Array<Track> = await redisGetStoryTracks(storyId);
  if (cachedTracks) return cachedTracks;

  // nothing cached, so we have to build the tracks
  const story: Story = await getItem(
    'Story',
    storyId,
    storyTracksReturnFragment
  );
  const tracks: Array<Track> = await getTracks(story);
  // cache the tracks -- no need to await
  await redisSetStoryTracks(storyId, JSON.stringify(tracks));
  return tracks;
};

export const getStoryHls = async (
  storyId: MongoId,
  writeStream: Response
): Promise<void> => {
  // TODO: look in redis cache for cached hls manifest
  // const cachedTracks = <Array<Track>>await redisGetStoryTracks(storyId);
  // if (cachedTracks) return cachedTracks;

  // nothing cached, so we have to build the tracks
  const story: Story = await getItem(
    'Story',
    storyId,
    storyTracksReturnFragment
  );
  await sendStoryHlsManifest(story, writeStream);
};
export const createStoryStub = async (
  userId: MongoId,
  topicId: MongoId,
  isPublic: boolean
): Promise<{
  id: MongoId;
  isPublic: boolean;
  interviewer: {
    id: MongoId;
    username: string;
    avatarImageMediaAsset: MediaAsset;
  };
}> => {
  const storyStub = await createItem(
    'Story',
    {
      interviewer: {
        connect: { id: userId },
      },
      topic: {
        connect: { id: topicId },
      },
      isPublic: isPublic,
    },
    `id
      isPublic
      interviewer {
        ${interviewerReturnFragment}
      }`
  );
  return storyStub;
};
export const restoreStory = async (
  storyId: MongoId
): Promise<{
  story: Story;
  sampleRate: AudioChannelSampleRate;
  topicQuestions: TopicMetadata;
}> => {
  // Find story
  const story: Story = await getItem(
    'Story',
    storyId,
    `id
    status
    isPublic
    topic {
      id
      title
    }
    interviewer {
      organisation {
        identifier
      }
    }
    metadata
    progress`
  );

  // lifecycle rule: only allowed to restore stories that are in state SAVED
  if (story.status !== StoryStatus.SAVED)
    throw `Trying to restore story ${storyId} which has status ${story.status} story lifecycle only permits stories with status SAVED to be restored`;

  // restore the saved story channels and the topic questions
  const savedStoryChannelsPromise: Promise<AudioChannel[]> = getItems(
    'AudioChannel',
    {
      story: {
        id: storyId,
      },
      status: StoryStatus.SAVED,
    },
    `id
    sampleRate
    chunks`
  );
  const topicQuestionsPromise: Promise<TopicMetadata> = packageTopicForPlayback(
    story.topic.id,
    story.interviewer.organisation.identifier
  );

  const promiseResponse: [AudioChannel[], TopicMetadata] = await Promise.all([
    savedStoryChannelsPromise,
    topicQuestionsPromise,
  ]);
  const savedStoryChannels: AudioChannel[] = promiseResponse[0];
  const topicQuestions: TopicMetadata = promiseResponse[1];

  await restoreStoryChannels(savedStoryChannels);

  // set story status to RECORDING
  await updateItem(
    'Story',
    story.id,
    {
      status: StoryStatus.RECORDING,
    },
    'id'
  );

  const storySampleRate =
    savedStoryChannels.length > 0
      ? savedStoryChannels[0].sampleRate
      : AudioChannelSampleRate.UNSPECIFIED;

  return {
    story,
    sampleRate: storySampleRate,
    topicQuestions,
  };
};
export const getStoryById = async (storyId: string): Promise<Story> => {
  return await getItem('Story', storyId, storyReturnFragment);
};
export const publishStory = async (
  storyId: string,
  storyData: PublishStoryData
): Promise<Story> => {
  const storyWithStatus: Story = await getItem(
    'Story',
    storyId,
    `id
    status`
  );

  // lifecycle rule: only allowed to publish stories that are in state RECORDING
  if (storyWithStatus.status !== StoryStatus.RECORDING)
    throw `Trying to publish story ${storyId} which has status ${storyWithStatus.status} story lifecycle only permits stories with status RECORDING to be published`;

  const { title, isPublic, selectedTags, duration, storyTellers } = storyData;
  const extractChannelsResult = await extractUsedChannelIds(
    storyId,
    storyData.metadata
  );

  const publishChannels = extractChannelsResult[0];
  const deleteChannels = extractChannelsResult[1];
  const invalidChannels = extractChannelsResult[2];

  if (invalidChannels.length > 0)
    console.warn(
      `Publish story encountered invalid channels in metadata for story ${storyId}, ignoring`
    );
  const auditResults = await Promise.all(
    publishChannels.map(channel => auditChannelIntegrity(channel))
  );
  const accumulatedResult = auditResults.reduce(
    (accBool, thisResult) => accBool && thisResult,
    true
  );
  if (!accumulatedResult)
    console.warn(
      `Publish story failed chunk availability audit for story ${storyId} and was unable to fix, ignoring`
    );
  const updatedStory = {
    title,
    isPublic: isPublic || false,
    storyTellers: storyTellers
      ? { connect: one2ManyGQLExpand(storyTellers) }
      : null,
    tags: { connect: one2ManyGQLExpand(selectedTags) },
    metadata: JSON.stringify(storyData.metadata),
    duration,
    status: StoryStatus.PUBLISHED,
    progress: 100, // set story recording progress to 100% (complete)
  };
  // save story to database
  const publishedStory: Story = await updateItem(
    'Story',
    storyId,
    updatedStory,
    storyReturnFragment
  );
  // update channel db statuses, also clear tracks cache since status has changed
  await Promise.all([
    ...deleteChannels.map(
      (channelId: MongoId): Promise<unknown> =>
        updateDBChannelStatus(
          channelId,
          AudioChannelStatus.DELETED,
          false,
          true
        )
    ),
    ...publishChannels.map(
      (channelId: MongoId): Promise<AudioChannel> =>
        updateDBChannelStatus(
          channelId,
          AudioChannelStatus.PUBLISHED,
          false,
          false
        )
    ),
    redisDelWithPrefix('storytracks', storyId),
  ]);
  await sendSystemEventEmail(
    `Story publication notification -- Org ${publishedStory.orgIdentifier} 
      ===============================
      Story ${storyId} has been successfully published.
      Userorg: ${publishedStory.orgIdentifier}
      Username: ${publishedStory.interviewer.username}
      Story title: ${publishedStory.title}
      Story duration: ${publishedStory.duration}
      isPublic: ${publishedStory.isPublic}
      <end>`
  );

  return publishedStory;
};
export const sendFinalisationEmail = (story: Story) => {
  return sendSystemEventEmail(
    `Story finalisation notification -- Org ${story.orgIdentifier} 
      ===============================
      Story ${story.id} has been successfully finalised.
      Userorg: ${story.orgIdentifier}
      Username: ${story.interviewer.username}
      Story title: ${story.title}
      Story duration: ${story.duration}
      isPublic: ${story.isPublic}
      <end>`
  );
};

export const saveStory = async (
  storyId: string,
  title: string,
  metadata: StoryMetadata,
  progress: number
): Promise<void> => {
  const storyWithStatus: Story = await getItem(
    'Story',
    storyId,
    `id
    status`
  );

  // lifecycle rule: only allowed to save stories that are in state RECORDING
  if (storyWithStatus.status !== StoryStatus.RECORDING)
    throw `Trying to restore story ${storyId} which has status ${storyWithStatus.status} story lifecycle only permits stories with status RECORDING to be published`;

  await updateItem(
    'Story',
    storyId,
    {
      metadata: JSON.stringify(metadata),
      title,
      status: StoryStatus.SAVED,
      progress,
    },
    'id'
  );

  const extractChannelsResponse = await extractUsedChannelIds(
    storyId,
    metadata
  );
  const usedChannelIds = extractChannelsResponse[0];
  const unusedChannelIds = extractChannelsResponse[1];

  // nested promise all steps through each used channel
  // and within each used channel uploads
  // each chunk to s3 saved then deletes from redis
  await Promise.all(
    usedChannelIds.map(async channelId => {
      const channel: AudioChannel = await getItem(
        'AudioChannel',
        channelId,
        `id
          status
          chunks`
      );
      const chunks: AudioChunk[] = JSON.parse(channel.chunks);
      await s3UploadChannelChunksPromise(channelId, chunks, 'saved', true);
    })
  );

  // terminate channel -- used channels set to saved, unused channels set to deleted
  await Promise.all([
    ...usedChannelIds.map(channelId =>
      terminateChannel(channelId, AudioChannelStatus.SAVED)
    ),
    ...unusedChannelIds.map(channelId => terminateChannel(channelId)),
  ]);
};
export const likeStory = async (
  userId: MongoId,
  storyId: MongoId
): Promise<void> => {
  await updateItem(
    'User',
    userId,
    {
      likedStories: {
        connect: {
          id: storyId,
        },
      },
    },
    'likedStories'
  );
};
export const unlikeStory = async (
  userId: MongoId,
  storyId: MongoId
): Promise<void> => {
  await updateItem(
    'User',
    userId,
    {
      likedStories: {
        disconnect: {
          id: storyId,
        },
      },
    },
    'likedStories'
  );
};
export const updateStoryDetails = async (
  storyId: MongoId,
  title: string,
  isPublic: boolean,
  tags: MongoId[],
  storyTellers: MongoId[] = []
): Promise<Story> => {
  const updatedStory: Story = await updateItem(
    'Story',
    storyId,
    {
      title: title,
      isPublic: isPublic,
      tags: {
        disconnectAll: true,
        connect: one2ManyGQLExpand(tags),
      },
      storyTellers: {
        disconnectAll: true,
        connect: one2ManyGQLExpand(storyTellers),
      },
    },
    storyReturnFragment
  );
  return updatedStory;
};
export const deleteStory = async (storyId: MongoId): Promise<void> => {
  const story: Story = await getItem(
    'Story',
    storyId,
    `id
      status`
  );

  switch (story.status) {
    case StoryStatus.RECORDING:
    case StoryStatus.SAVED:
      await terminateStoryChannels(storyId);
      break;
    case StoryStatus.PUBLISHED:
    case StoryStatus.PUBLISHED_FINALISED:
      await deleteAssociatedArtefacts(storyId);
      break;
  }

  // Find story
  await updateItem(
    'Story',
    storyId,
    {
      status: StoryStatus.DELETED,
    },
    'id'
  );
};

export const getStories = async (userId: MongoId) => {
  const user = await getItem(
    'User',
    userId,
    `id
    organisation {
      id
    }`
  );
  console.log(user.organisation.id)
  const stories = await getItems(
    'Story',
    {interviewer :{
      organisation: {
        id:user.organisation.id,
      }
    }},
    storyReturnFragment
  );
  return stories;
}