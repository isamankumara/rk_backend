import { Readable } from 'stream';
import moment from 'moment';
import {
  redisSetPromise,
  redisSetChunk,
  redisGetChunk,
  redisSetChannelInfo,
  redisGetChannelInfo,
  redisSetStoryTracks,
  redisGetStoryTracks,
  redisDelWithPrefix,
  redisDelPromise,
  redisPing,
  redisFlushAllPromise,
  pipeReadStreamToRedisPromise,
  getKeysByPrefix,
  redisDeclutter,
  redisGetTimestamp,
  redisExistsPromise,
} from '../../src/utils/RedisUtil';
import { objectExistsInS3Bucket } from '../../src/utils/AWSUtil';
import { dbAtTrackingTimeFormat } from '../../src/appConstants';

describe('Redis util tests', () => {
  const testAudioData = [0, 1, 2, 3];

  beforeAll(async () => {
    try {
      jest.setTimeout(30000); // this must be the first command, otherwise jest will not honour promises...
      await redisFlushAllPromise();
    } catch (err) {
      console.error(err);
    }
  });

  test('Redis ping', async () => {
    const redisResponse = await redisPing();
    expect(redisResponse.toString()).toBe('PONG');
  });

  test('Redis set get audio data with timestamp then delwithprefix', async () => {
    await redisSetChunk(
      'testSetGetAudioData',
      Buffer.from(...([testAudioData] as const))
    );
    const redisGet = await redisGetChunk('testSetGetAudioData');
    const timestamp = await redisGetTimestamp('chunk', 'testSetGetAudioData');
    expect(testAudioData.length).toEqual(redisGet.length);
    expect(timestamp).not.toBeFalsy();
    await redisDelWithPrefix('chunk', 'testSetGetAudioData');
    expect(await redisExistsPromise('chunk:testSetGetAudioData')).toBe(0);
    expect(await redisGetTimestamp('chunk', 'testSetGetAudioData')).toBeFalsy();
  });

  test('Redis set get channel info with timestamp then delwithprefix', async () => {
    await redisSetChannelInfo(
      'testSetGetStringify',
      JSON.stringify({
        test: 'test',
      })
    );
    const redisGetChannelInfoResult = await redisGetChannelInfo(
      'testSetGetStringify'
    );
    const timestamp = await redisGetTimestamp(
      'channelinfo',
      'testSetGetStringify'
    );
    expect(redisGetChannelInfoResult).toEqual({
      test: 'test',
    });
    expect(timestamp).not.toBeFalsy();
    await redisDelWithPrefix('channelinfo', 'testSetGetStringify');
    expect(await redisExistsPromise('channelinfo:testSetGetStringify')).toBe(0);
    expect(
      await redisGetTimestamp('channelinfo', 'testSetGetStringify')
    ).toBeFalsy();
  });

  test('Redis get nonexistent channel', async () => {
    const redisGetChannelInfoResult = await redisGetChannelInfo('nonexistent');
    expect(redisGetChannelInfoResult).toBeFalsy();
  });

  test('Redis set get storytracks with timestamp then delwithprefix', async () => {
    await redisSetStoryTracks(
      'testSetGetStoryTracks',
      JSON.stringify([
        {
          test: 'test',
        },
      ])
    );
    const redisGetStoryTracksResult = await redisGetStoryTracks(
      'testSetGetStoryTracks'
    );
    const timestamp = await redisGetTimestamp(
      'storytracks',
      'testSetGetStoryTracks'
    );
    expect(redisGetStoryTracksResult).toEqual([
      {
        test: 'test',
      },
    ]);
    expect(timestamp).not.toBeFalsy();
    await redisDelWithPrefix('storytracks', 'testSetGetStoryTracks');
    expect(await redisExistsPromise('storytracks:testSetGetStoryTracks')).toBe(
      0
    );
    expect(
      await redisGetTimestamp('storytracks', 'testSetGetStoryTracks')
    ).toBeFalsy();
  });

  test('Redis get nonexistent storytracks', async () => {
    const redisGetStoryTracksResult = await redisGetStoryTracks('nonexistent');
    expect(redisGetStoryTracksResult).toBeFalsy();
  });

  test('pipeReadStreamToRedisPromise', async () => {
    const chunkStream = Readable.from(Buffer.from([...testAudioData]));
    await pipeReadStreamToRedisPromise(
      chunkStream,
      'chunk',
      'testPipeReadStream'
    );
    const redisGet = await redisGetChunk('testPipeReadStream');
    expect(testAudioData.length).toEqual(redisGet.length);
  });

  test('getKeysByPrefix', async () => {
    await redisSetPromise('testPrefix:1', '1');
    await redisSetPromise('testPrefix:2', '2');
    await redisSetPromise('testPrefix:3', '3');

    const keys = await getKeysByPrefix('testPrefix');
    expect(keys.length).toBe(3);

    const keys2 = await getKeysByPrefix('nonexistentPrefix');
    expect(keys2.length).toBe(0);
  });

  test('redis declutter at now', async () => {
    const testChannelInfo = { test };
    await redisFlushAllPromise();

    // set some channels and chunks
    await redisSetChunk('1', Buffer.from(testAudioData));
    await redisSetChunk('2', Buffer.from(testAudioData));
    await redisSetChunk('3', Buffer.from(testAudioData));
    await redisSetChannelInfo('1', JSON.stringify(testChannelInfo));
    await redisSetChannelInfo('2', JSON.stringify(testChannelInfo));
    await redisSetChannelInfo('3', JSON.stringify(testChannelInfo));

    // redis declutter at "now" -- nothing should get deleted
    const nowTimepoint = moment().format(dbAtTrackingTimeFormat);
    await redisDeclutter(12, 'DELETE', nowTimepoint);
    const chunkKeys = await getKeysByPrefix('chunk');
    const channelInfoKeys = await getKeysByPrefix('channelinfo');
    expect(chunkKeys.length).toBe(3);
    expect(channelInfoKeys.length).toBe(3);
  });

  test('redis declutter at now with corrupt timestamp', async () => {
    await redisFlushAllPromise();

    // set some channels and chunks
    await redisSetChunk('1', Buffer.from(testAudioData));
    await redisSetChunk('2', Buffer.from(testAudioData));

    // simulate timestamp corruption by removing the '1' object
    await redisDelPromise('chunk:1');

    // redis declutter at "now" -- the '1' timestamp only should get deleted
    const nowTimepoint = moment().format(dbAtTrackingTimeFormat);
    await redisDeclutter(12, 'DELETE', nowTimepoint);
    const chunk1 = await redisGetChunk('1');
    const chunk2 = await redisGetChunk('2');
    const timestamp1 = await redisGetTimestamp('chunk', '1');
    const timestamp2 = await redisGetTimestamp('chunk', '2');
    expect(chunk1).toBeFalsy();
    expect(chunk2).not.toBeFalsy();
    expect(timestamp1).toBeFalsy();
    expect(timestamp2).not.toBeFalsy();
  });

  test('redis declutter at 1 day later', async () => {
    const testChannelInfo = { test };
    await redisFlushAllPromise();

    // set some channels and chunks
    await redisSetChunk('1', Buffer.from(testAudioData));
    await redisSetChunk('2', Buffer.from(testAudioData));
    await redisSetChunk('3', Buffer.from(testAudioData));
    await redisSetChannelInfo('1', JSON.stringify(testChannelInfo));
    await redisSetChannelInfo('2', JSON.stringify(testChannelInfo));
    await redisSetChannelInfo('3', JSON.stringify(testChannelInfo));

    // redis declutter at 1 day later -- all should get deleted
    const futureTimePoint = moment()
      .add(1, 'days')
      .format(dbAtTrackingTimeFormat);
    await redisDeclutter(12, 'DELETE', futureTimePoint);
    const chunkKeys = await getKeysByPrefix('chunk');
    const channelInfoKeys = await getKeysByPrefix('channelinfo');
    expect(chunkKeys.length).toBe(0);
    expect(channelInfoKeys.length).toBe(0);
  });

  test('redis declutter at 1 day later with declutter archive', async () => {
    const testChannelInfo = { test };
    await redisFlushAllPromise();

    // set some channels and chunks
    await redisSetChunk('1', Buffer.from(testAudioData));
    await redisSetChunk('2', Buffer.from(testAudioData));
    await redisSetChunk('3', Buffer.from(testAudioData));
    await redisSetChannelInfo('1', JSON.stringify(testChannelInfo));
    await redisSetChannelInfo('2', JSON.stringify(testChannelInfo));
    await redisSetChannelInfo('3', JSON.stringify(testChannelInfo));

    // redis declutter at 1 day later -- all should get deleted and uploaded to declutter folder
    const futureTimePoint = moment()
      .add(1, 'days')
      .format(dbAtTrackingTimeFormat);
    await redisDeclutter(12, 'ARCHIVE', futureTimePoint);
    const chunkKeys = await getKeysByPrefix('chunk');
    const channelInfoKeys = await getKeysByPrefix('channelinfo');
    expect(chunkKeys.length).toBe(0);
    expect(channelInfoKeys.length).toBe(0);

    // check files uploaded
    const declutterArchiveExistsOnRedisChunk1 = await objectExistsInS3Bucket(
      process.env.TEST_OPERATIONAL_BUCKET,
      `declutter/chunk/1`
    );
    expect(declutterArchiveExistsOnRedisChunk1).toBe(true);
    const declutterArchiveExistsOnRedisChunk2 = await objectExistsInS3Bucket(
      process.env.TEST_OPERATIONAL_BUCKET,
      `declutter/chunk/2`
    );
    expect(declutterArchiveExistsOnRedisChunk2).toBe(true);
    const declutterArchiveExistsOnRedisChunk3 = await objectExistsInS3Bucket(
      process.env.TEST_OPERATIONAL_BUCKET,
      `declutter/chunk/3`
    );
    expect(declutterArchiveExistsOnRedisChunk3).toBe(true);
    const declutterArchiveExistsOnRedisChannelInfo1 = await objectExistsInS3Bucket(
      process.env.TEST_OPERATIONAL_BUCKET,
      `declutter/channelinfo/1`
    );
    expect(declutterArchiveExistsOnRedisChannelInfo1).toBe(true);
    const declutterArchiveExistsOnRedisChannelInfo2 = await objectExistsInS3Bucket(
      process.env.TEST_OPERATIONAL_BUCKET,
      `declutter/channelinfo/2`
    );
    expect(declutterArchiveExistsOnRedisChannelInfo2).toBe(true);
    const declutterArchiveExistsOnRedisChannelInfo3 = await objectExistsInS3Bucket(
      process.env.TEST_OPERATIONAL_BUCKET,
      `declutter/channelinfo/3`
    );
    expect(declutterArchiveExistsOnRedisChannelInfo3).toBe(true);
  });

  afterAll(async () => {});
});
