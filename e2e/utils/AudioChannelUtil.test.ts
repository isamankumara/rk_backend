import request from 'supertest';
import { objectExistsInS3Bucket } from '../../src/utils/AWSUtil';
import { redisGetChunk, redisGetChannelInfo } from '../../src/utils/RedisUtil';
import {
  terminateChannel,
  extractUsedChannelIds,
  updateDBChannelStatus,
  s3UploadChannelChunksPromise,
  channelIdToChannelInfo,
  channelObjectToChannelInfo,
  channelDownstreamUrl,
} from '../../src/utils/AudioChannelUtil';
import { getItem } from '../../src/controllers/GQL';
import {
  prereqs,
  signup,
  topicId,
  createStoryAndRetrieveMetadata,
  editStory,
  requestChannel,
  teardown,
} from '../../jest/e2eUtil';
import {
  AudioChannelStatus,
  ContentTypes,
} from '../../src/ts/types/contentTypes';

describe('Audio channel util tests', () => {
  let app, testUserAuthToken, testTopicId;

  beforeAll(async () => {
    try {
      jest.setTimeout(1800000); // this must be the first command, otherwise jest will not honour promises...
      app = await prereqs(true, true, [
        ContentTypes.Theme,
        ContentTypes.Topic,
        ContentTypes.Question,
      ]);
      testUserAuthToken = await signup(app);
      testTopicId = await topicId();
    } catch (err) {
      console.error(err);
    }
  });

  test('Terminate channel with no archiving requested', async () => {
    const { storyId, metadata } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    const channelIds = await editStory(
      app,
      storyId,
      metadata,
      ['e2eb/TEST/SHQ1'],
      testUserAuthToken
    );
    const channelId = channelIds[0];
    await terminateChannel(channelId, 'DELETED');

    // channel should be set to deleted in db, channel object should not exist in redis, chunk should not exist in redis
    const channel = await getItem(
      'AudioChannel',
      channelId,
      `id
      status`
    );

    expect(channel.status).toBe('DELETED');

    const channelInfo = await redisGetChunk(`${channelId}`);
    const chanExists = channelInfo !== null;
    expect(chanExists).toBe(false);
  });

  test('Extract supplied channel ids using parameter method', async () => {
    const { storyId, metadata } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    await editStory(
      app,
      storyId,
      metadata,
      ['e2eb/TEST/SHQ1', 'e2eb/TEST/SHQ2'],
      testUserAuthToken
    );
    const response = await requestChannel(app, storyId, testUserAuthToken);
    const testChannel3Id = response.body.channelId;
    const [usedChannelIds, unusedChannelIds] = await extractUsedChannelIds(
      storyId,
      metadata
    );
    expect(usedChannelIds.length).toBe(2);
    expect(unusedChannelIds.length).toBe(1);
    expect(unusedChannelIds[0]).toBe(testChannel3Id);
  });

  test('updateDBChannelStatus RECORDING to PUBLISHED', async () => {
    const { storyId } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    const response = await requestChannel(app, storyId, testUserAuthToken);
    const testChannelId = response.body.channelId;
    const updatedChannel = await updateDBChannelStatus(
      testChannelId,
      AudioChannelStatus.PUBLISHED
    );
    expect(updatedChannel.id).toBe(testChannelId);
    expect(updatedChannel.status).toBe('PUBLISHED');
  });

  test('updateDBChannelStatus RECORDING to PUBLISHED with write to redis', async () => {
    const { storyId } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    const response = await requestChannel(app, storyId, testUserAuthToken);
    const testChannelId = response.body.channelId;
    const updatedChannel = await updateDBChannelStatus(
      testChannelId,
      AudioChannelStatus.PUBLISHED,
      true
    );
    const redisChannel = await redisGetChannelInfo(testChannelId);
    expect(updatedChannel.id).toBe(testChannelId);
    expect(updatedChannel.status).toBe('PUBLISHED');
    expect(redisChannel).toEqual(
      expect.objectContaining({
        audioDuration: 0,
        inputChannels: 1,
        sampleRate: 16000,
        chunks: expect.any(Array),
      })
    );
  });

  test('updateDBChannelStatus RECORDING to PUBLISHED with delete from redis', async () => {
    const { storyId } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    const response = await requestChannel(app, storyId, testUserAuthToken);
    const testChannelId = response.body.channelId;
    await updateDBChannelStatus(
      testChannelId,
      AudioChannelStatus.PUBLISHED,
      true
    );
    const updatedChannel = await updateDBChannelStatus(
      testChannelId,
      AudioChannelStatus.DELETED,
      false,
      true
    );
    const redisChannel = await redisGetChannelInfo(updatedChannel.id);
    expect(redisChannel).toBeFalsy();
  });

  test('s3UploadChannelChunksPromise without redis delete', async () => {
    // create a channel and upload two chunks
    const { storyId, metadata } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    const channelIds = await editStory(
      app,
      storyId,
      metadata,
      ['e2eb/TEST/SHQ1'],
      testUserAuthToken,
      2
    );
    const testChannel1Id = channelIds[0];
    // get the chunks descriptor from redis
    const redisChannel = await redisGetChannelInfo(testChannel1Id);
    await s3UploadChannelChunksPromise(testChannel1Id, redisChannel.chunks);
    const chunk1ExistsOnS3 = await objectExistsInS3Bucket(
      process.env.TEST_OPERATIONAL_BUCKET,
      `archived/${testChannel1Id}/${redisChannel.chunks[0].chunkId}`
    );
    const chunk2ExistsOnS3 = await objectExistsInS3Bucket(
      process.env.TEST_OPERATIONAL_BUCKET,
      `archived/${testChannel1Id}/${redisChannel.chunks[1].chunkId}`
    );
    const chunk1OnRedis = await redisGetChunk(redisChannel.chunks[0].chunkId);
    const chunk2OnRedis = await redisGetChunk(redisChannel.chunks[1].chunkId);
    expect(chunk1ExistsOnS3).toBe(true);
    expect(chunk2ExistsOnS3).toBe(true);
    expect(chunk1OnRedis).not.toBeFalsy();
    expect(chunk2OnRedis).not.toBeFalsy();
  });

  test('s3UploadChannelChunksPromise with redis delete', async () => {
    // create a channel and upload two chunks
    const { storyId, metadata } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    const channelIds = await editStory(
      app,
      storyId,
      metadata,
      ['e2eb/TEST/SHQ1'],
      testUserAuthToken,
      2
    );
    const testChannel1Id = channelIds[0];
    // get the chunks descriptor from redis
    const redisChannel = await redisGetChannelInfo(testChannel1Id);
    await s3UploadChannelChunksPromise(
      testChannel1Id,
      redisChannel.chunks,
      'archived',
      true
    );
    const chunk1ExistsOnS3 = await objectExistsInS3Bucket(
      process.env.TEST_OPERATIONAL_BUCKET,
      `archived/${testChannel1Id}/${redisChannel.chunks[0].chunkId}`
    );
    const chunk2ExistsOnS3 = await objectExistsInS3Bucket(
      process.env.TEST_OPERATIONAL_BUCKET,
      `archived/${testChannel1Id}/${redisChannel.chunks[1].chunkId}`
    );
    const chunk1OnRedis = await redisGetChunk(redisChannel.chunks[0].chunkId);
    const chunk2OnRedis = await redisGetChunk(redisChannel.chunks[1].chunkId);
    expect(chunk1ExistsOnS3).toBe(true);
    expect(chunk2ExistsOnS3).toBe(true);
    expect(chunk1OnRedis).toBeFalsy();
    expect(chunk2OnRedis).toBeFalsy();
  });

  test('channel object to channel info', async () => {
    const { storyId, metadata } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    const channelIds = await editStory(
      app,
      storyId,
      metadata,
      ['e2eb/TEST/SHQ1'],
      testUserAuthToken,
      2
    );
    const testChannelId = channelIds[0];
    const audioChannel = await getItem(
      'AudioChannel',
      testChannelId,
      `id
      story {
        id
      }
      duration
      sampleRate
      inputChannels
      chunks`
    );
    const channel = channelObjectToChannelInfo(audioChannel);
    expect(channel.storyId).toBe(storyId);
    expect(channel.sampleRate).toBe(16000);
    expect(channel.inputChannels).toBe(1);
    expect(channel.chunks.length).toBe(2);
  });

  test('channel id to channel info', async () => {
    const { storyId, metadata } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    const channelIds = await editStory(
      app,
      storyId,
      metadata,
      ['e2eb/TEST/SHQ1'],
      testUserAuthToken,
      2
    );
    const testChannelId = channelIds[0];
    const audioChannel = await getItem(
      'AudioChannel',
      testChannelId,
      `id
      story {
        id
      }
      duration
      sampleRate
      inputChannels
      chunks`
    );
    const channel = await channelIdToChannelInfo(audioChannel.id);
    expect(channel.storyId).toBe(storyId);
    expect(channel.sampleRate).toBe(16000);
    expect(channel.inputChannels).toBe(1);
    expect(channel.chunks.length).toBe(2);
  });
  test('downstream channel url', async () => {
    const { storyId, metadata } = await createStoryAndRetrieveMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    const channelIds = await editStory(
      app,
      storyId,
      metadata,
      ['e2eb/TEST/SHQ1'],
      testUserAuthToken,
      2
    );
    const response = await request(app).get(
      channelDownstreamUrl(channelIds[0])
    );
    expect(response.statusCode).toBe(200);
  });

  afterAll(async done => {
    await teardown(done, app, true, 10000); // throttle to avoid 'import after teardown' console error
  });
});
