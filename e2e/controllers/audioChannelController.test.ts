import { getItems, getItem, updateItem } from '../../src/controllers/GQL';
import moment from 'moment';
import { dbAtTrackingTimeFormat } from '../../src/appConstants';
import {
  cleanupAudioChannels,
  terminateStoryChannels,
  auditChannelIntegrity,
} from '../../src/services/audiochannel/helpers/AudioChannelLifecycleHelper';
import {
  redisGetChannelInfo,
  redisGetChunk,
  redisDelWithPrefix,
} from '../../src/utils/RedisUtil';
import {
  objectExistsInS3Bucket,
  emptyS3Directory,
} from '../../src/utils/AWSUtil';
import {
  delay,
  prereqs,
  signup,
  topicId,
  createStoryAndRetrieveMetadata,
  requestChannel,
  upstream,
  downstream,
  editStory,
  createStory,
  teardown,
  clearChannel,
  chunkId,
} from '../../jest/e2eUtil';
import {
  AudioChannelSampleRate,
  ContentTypes,
  DeclutterArchivePolicy,
} from '../../src/ts/types/contentTypes';

let testUserAuthToken, testTopicId, testStoryId, testChannelId;

describe('Audio channel controller tests', () => {
  let app;
  beforeAll(async () => {
    try {
      jest.setTimeout(90000); // this must be the first command, otherwise jest will not honour promises...
      app = await prereqs(true, true, [
        ContentTypes.Theme,
        ContentTypes.Topic,
        ContentTypes.Question,
      ]);
      testUserAuthToken = await signup(app);
      testTopicId = await topicId();
      const result = await createStoryAndRetrieveMetadata(
        app,
        testTopicId,
        testUserAuthToken
      );
      testStoryId = result.storyId;
    } catch (err) {
      console.error(err);
    }
  });

  test('Request LOW channel for pre-existing story', async () => {
    const response = await requestChannel(app, testStoryId, testUserAuthToken);
    expect(response.statusCode).toBe(200);
    testChannelId = response.body.channelId;
  });

  test('Upstream normal chunk on wrong channel', async () => {
    const response = await upstream(
      app,
      'NOTACHANNEL',
      chunkId(),
      testUserAuthToken,
      false
    );
    expect(response.statusCode).toBe(406);
  });

  test('Upstream normal chunk on requested channel', async () => {
    const response = await upstream(
      app,
      testChannelId,
      chunkId(),
      testUserAuthToken,
      false
    );
    expect(response.statusCode).toBe(200);
  });

  test('Upstream final chunk on requested channel', async () => {
    const response = await upstream(
      app,
      testChannelId,
      chunkId(),
      testUserAuthToken,
      true
    );
    expect(response.statusCode).toBe(200);
  });

  test('Downstream recorded audio test', async () => {
    const response = await downstream(app, testChannelId);
    expect(response.statusCode).toBe(200);
  });

  test('Downstream recorded audio when channel info has expired from redis cache', async () => {
    await redisDelWithPrefix('channelinfo', testChannelId);
    const response = await downstream(app, testChannelId);
    expect(response.statusCode).toBe(200);
  });

  test('Cleanup channels when channel is valid', async () => {
    await cleanupAudioChannels(12, DeclutterArchivePolicy.DELETE);
    const dbRecordingChannels = await getItems(
      'AudioChannel',
      {
        status: 'RECORDING',
      },
      'id'
    );
    expect(dbRecordingChannels.length).toBe(1);
    expect(dbRecordingChannels[0].id).toBe(testChannelId);
  });

  test('Cleanup channels when channel is expired with declutter delete policy', async () => {
    const response0 = await createStory(app, testTopicId, testUserAuthToken);
    const thisTestStoryId = response0.body.id;

    // request a channel and upstream some audio
    const response = await requestChannel(app, testStoryId, testUserAuthToken);
    const thisTestChannelId = response.body.channelId;
    await upstream(app, thisTestChannelId, chunkId(), testUserAuthToken, true);

    const checkTimePoint = moment()
      .add(5, 'days')
      .format(dbAtTrackingTimeFormat);

    // mock the story status to 'PUBLISHED' to simulate condition where channel has become an orphan
    await updateItem(
      'Story',
      thisTestStoryId,
      {
        status: 'PUBLISHED',
      },
      'id'
    );

    await cleanupAudioChannels(
      12,
      DeclutterArchivePolicy.DELETE,
      checkTimePoint
    );
    const dbRecordingChannels = await getItems(
      'AudioChannel',
      {
        status: 'RECORDING',
      },
      'id'
    );
    expect(dbRecordingChannels.length).toBe(0);
  });

  test('Cleanup channels when channel is expired with declutter archive policy', async () => {
    const response0 = await createStory(app, testTopicId, testUserAuthToken);
    const thisTestStoryId = response0.body.id;

    // request a channel and upstream some audio
    const response = await requestChannel(app, testStoryId, testUserAuthToken);
    const thisTestChannelId = response.body.channelId;
    await upstream(app, thisTestChannelId, chunkId(), testUserAuthToken, true);

    // find out the uploaded chunkId for verification purposes
    const thisChannelInfo = await redisGetChannelInfo(thisTestChannelId);
    const savedChunk = thisChannelInfo.chunks[0];

    const checkTimePoint = moment()
      .add(5, 'days')
      .format(dbAtTrackingTimeFormat);

    // mock the story status to 'PUBLISHED' to simulate condition where channel has become an orphan
    await updateItem(
      'Story',
      thisTestStoryId,
      {
        status: 'PUBLISHED',
      },
      'id'
    );

    await cleanupAudioChannels(
      12,
      DeclutterArchivePolicy.ARCHIVE,
      checkTimePoint
    );
    const storyRecordingChannels = await getItems(
      'AudioChannel',
      {
        status: 'RECORDING',
        story: {
          id: thisTestStoryId,
        },
      },
      'id'
    );
    expect(storyRecordingChannels.length).toBe(0);

    // check archived and deleted off redis
    const chunkExistsOnS3 = await objectExistsInS3Bucket(
      process.env.TEST_OPERATIONAL_BUCKET,
      `archived/${thisTestChannelId}/${savedChunk.chunkId}`
    );
    const chunkOnRedis = await redisGetChunk(savedChunk.chunkId);

    expect(chunkExistsOnS3).toBe(true);
    expect(chunkOnRedis).toBeFalsy();
  });

  test('Terminate story channels', async () => {
    const {
      storyId: thisTestStoryId,
      metadata,
    } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );

    // request a channel and upstream some audio, then save against the story
    const channelIds = await editStory(
      app,
      thisTestStoryId,
      metadata,
      ['e2eb/TEST/SHQ1'],
      testUserAuthToken,
      3
    );
    const thisTestChannelId = channelIds[0];
    await updateItem('Story', thisTestStoryId, {
      metadata: JSON.stringify(metadata),
    });

    await terminateStoryChannels(thisTestStoryId);
    const terminatedChannel = await getItem(
      'AudioChannel',
      thisTestChannelId,
      `id
      status
      chunks`
    );
    const channelRedisInfo = await redisGetChannelInfo(thisTestChannelId);
    const theRecordedChunk = JSON.parse(terminatedChannel.chunks)[0];
    const theRecordedChunkInRedis = await redisGetChunk(
      theRecordedChunk.chunkId
    );
    expect(theRecordedChunkInRedis).toBeFalsy();
    expect(channelRedisInfo).toBeFalsy();
    expect(terminatedChannel.status).toBe('DELETED');
  });

  test('Clear channel', async () => {
    const {
      storyId: thisTestStoryId,
      metadata,
    } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );

    // request a channel and upstream some audio, then save against the story
    const channelIds = await editStory(
      app,
      thisTestStoryId,
      metadata,
      ['e2eb/TEST/SHQ1'],
      testUserAuthToken,
      3
    );
    const thisTestChannelId = channelIds[0];
    const clearResponse = await clearChannel(
      app,
      thisTestChannelId,
      testUserAuthToken
    );
    expect(clearResponse.status).toBe(200);
    const clearedChannelInfo = await redisGetChannelInfo(thisTestChannelId);
    expect(clearedChannelInfo).toEqual({
      audioDuration: 0,
      channelId: thisTestChannelId,
      chunks: [],
      inputChannels: 1,
      sampleRate: 16000,
      storyId: thisTestStoryId,
    });
  });

  test('auditChannelIntegrity with a clean channel', async () => {
    const {
      storyId: thisTestStoryId,
      metadata,
    } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    const channelIds = await editStory(
      app,
      thisTestStoryId,
      metadata,
      ['e2eb/TEST/SHQ1'],
      testUserAuthToken,
      1
    );
    const thisChannelId = channelIds[0];
    await delay(5000); // for real-time performance reasons, the server does not wait for upload to complete
    const integrity = await auditChannelIntegrity(thisChannelId);
    expect(integrity).toBe(true);
  });

  test('auditChannelIntegrity with a corrupt channel which can be recovered', async () => {
    const {
      storyId: thisTestStoryId,
      metadata,
    } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    const channelIds = await editStory(
      app,
      thisTestStoryId,
      metadata,
      ['e2eb/TEST/SHQ1'],
      testUserAuthToken,
      1
    );
    const thisChannelId = channelIds[0];
    await delay(5000); // for real-time performance reasons, the server does not wait for upload to complete
    await emptyS3Directory(
      process.env.TEST_OPERATIONAL_BUCKET,
      `stream/${thisChannelId}`
    ); // simulate corruption
    const integrity = await auditChannelIntegrity(thisChannelId);
    expect(integrity).toBe(true);
  });

  test('auditChannelIntegrity with a corrupt channel which cant be recovered', async () => {
    const {
      storyId: thisTestStoryId,
      metadata,
    } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    const channelIds = await editStory(
      app,
      thisTestStoryId,
      metadata,
      ['e2eb/TEST/SHQ1'],
      testUserAuthToken,
      1
    );
    const thisChannelId = channelIds[0];
    await delay(5000); // for real-time performance reasons, the server does not wait for upload to complete
    await emptyS3Directory(
      process.env.TEST_OPERATIONAL_BUCKET,
      `stream/${thisChannelId}`
    ); // simulate corruption
    const channel = await getItem(
      'AudioChannel',
      thisChannelId,
      `id
      chunks`
    );
    const chunk = JSON.parse(channel.chunks)[0];
    await redisDelWithPrefix('chunk', chunk.chunkId); // make the chunk irrecoverable
    await auditChannelIntegrity(thisChannelId);
  });

  test('Low quality Downstream recorded audio test', async () => {
    // create a new story
    const { storyId, metadata } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    const testChannels = await editStory(
      app,
      storyId,
      metadata,
      ['e2eb/TEST/SHQ1'],
      testUserAuthToken,
      5,
      'PARALLEL',
      0,
      AudioChannelSampleRate.LOW
    );

    const response = await downstream(app, testChannels[0]);
    expect(response.statusCode).toBe(200);
  });

  test('Low Downstream recorded audio test', async () => {
    // create a new story
    const { storyId, metadata } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    const testChannels = await editStory(
      app,
      storyId,
      metadata,
      ['e2eb/TEST/SHQ1'],
      testUserAuthToken,
      5,
      'PARALLEL',
      0,
      AudioChannelSampleRate.LOW
    );

    const response = await downstream(app, testChannels[0]);
    expect(response.statusCode).toBe(200);
  });

  test('High quality Downstream recorded audio test', async () => {
    // create a new story
    const { storyId, metadata } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    const testChannels = await editStory(
      app,
      storyId,
      metadata,
      ['e2eb/TEST/SHQ1'],
      testUserAuthToken,
      5,
      'PARALLEL',
      0,
      AudioChannelSampleRate.HIGH
    );

    const response = await downstream(app, testChannels[0]);
    expect(response.statusCode).toBe(200);
  });

  afterAll(async done => {
    await teardown(done, app);
  });
});
