const { promisify } = require('util');
const redis = require('redis');
require('redis-streams')(redis);
const moment = require('moment');
const { s3UploadStreamPromise } = require('./AWSUtil');
const { dbAtTrackingTimeFormat } = require('../appConstants');
const { REDIS_HOST, REDIS_PORT } = process.env;

const redisLogListener = (type, fn) =>
  fn
    ? () => {
        console.log(`connection ${type}`);
      }
    : console.log(`connection ${type}`);

const options = {
  return_buffers: true,
  retry_unfulfilled_commands: true,
  retry_strategy: options => {
    const { error, total_retry_time } = options;
    if (error && error.code === 'ECONNREFUSED') {
      console.error(error.code); // take actions or throw exception
    }
    if (error && error.code === 'ECONNRESET') {
      console.error(error.code); // take actions or throw exception
    }
    if (total_retry_time > 1000 * 15) {
      //in ms i.e. 15 sec
      console.log('Retry time exhausted'); // take actions or throw exception
    }
    if (options.attempt > 10) {
      console.log('10 attempts done'); // take actions or throw exception
    }
    console.log('Attempting connection');
    return Math.min(options.attempt * 50, 3000); //in ms
  },
};

let redisClient;
if (process.env.NODE_ENV === 'test' && process.env.TEST_REDIS !== 'true')
  redisClient = {
    on: () => {},
    ping: () => {},
    exists: () => {},
    set: () => {},
    get: () => {},
    del: () => {},
    flushall: () => {},
    scan: () => {},
  };
else redisClient = redis.createClient(REDIS_PORT, REDIS_HOST, options);
redisClient.on('connect', redisLogListener('connect', true));
redisClient.on('ready', redisLogListener('ready', true));
redisClient.on('reconnecting', redisLogListener('reconnecting', true));
redisClient.on('error', redisLogListener('error', true));
redisClient.on('end', redisLogListener('end', true));

// set and get helper methods
const redisPing = promisify(redisClient.ping).bind(redisClient);
const redisExistsPromise = promisify(redisClient.exists).bind(redisClient);
const redisSetPromise = promisify(redisClient.set).bind(redisClient);
const redisGetPromise = promisify(redisClient.get).bind(redisClient);
const redisDelPromise = promisify(redisClient.del).bind(redisClient);
const redisFlushAllPromise = promisify(redisClient.flushall).bind(redisClient);
const redisScanPromise = promisify(redisClient.scan).bind(redisClient);

const timestamp = () => {
  return moment().format(dbAtTrackingTimeFormat);
};

const redisSetChunk = async (chunkId, chunk) => {
  await Promise.all([
    redisSetPromise(`chunk:${chunkId}`, chunk),
    redisSetPromise(`timestamp:chunk:${chunkId}`, timestamp()),
  ]);
};
const redisGetChunk = async chunkId => {
  return await redisGetPromise(`chunk:${chunkId}`);
};
const redisGetTimestamp = async (prefix, key) => {
  try {
    return (await redisGetPromise(`timestamp:${prefix}:${key}`)).toString();
  } catch (err) {
    return '';
  }
};

const redisSetChannelInfo = async (channelId, channelJson) => {
  await Promise.all([
    redisSetPromise(`channelinfo:${channelId}`, channelJson),
    redisSetPromise(`timestamp:channelinfo:${channelId}`, timestamp()),
  ]);
};
const redisGetChannelInfo = async channelId => {
  return JSON.parse(await redisGetPromise(`channelinfo:${channelId}`));
};

const redisSetStoryTracks = async (storyId, storyJson) => {
  await Promise.all([
    redisSetPromise(`storytracks:${storyId}`, storyJson),
    redisSetPromise(`timestamp:storytracks:${storyId}`, timestamp()),
  ]);
};
const redisGetStoryTracks = async storyId => {
  return JSON.parse(await redisGetPromise(`storytracks:${storyId}`));
};

const redisDelWithPrefix = async (prefix, key) => {
  return await Promise.all([
    redisDelPromise(`${prefix}:${key}`),
    redisDelPromise(`timestamp:${prefix}:${key}`),
  ]);
};

const pipeReadStreamToRedisPromise = (readStream, prefix, key) => {
  return new Promise((resolve, reject) => {
    const redisStream = redisClient.writeStream(`${prefix}:${key}`);
    readStream
      .pipe(redisStream)
      .on('finish', async function () {
        await redisSetPromise(`timestamp:${prefix}:${key}`, timestamp());
        resolve();
      })
      .on('error', function (err) {
        console.error('pipeReadStreamToRedisPromise error ', err);
        reject(err);
      });
  });
};

const getKeysByPrefix = async prefix => {
  try {
    let cursor = '0',
      loopCount = 0;
    const keys = [];
    do {
      const scanReturn = await redisScanPromise(cursor, 'MATCH', `${prefix}:*`);
      cursor = scanReturn[0].toString();
      keys.push(
        ...scanReturn[1].map(keyBuf =>
          keyBuf.toString().slice(prefix.length + 1)
        )
      ); // strip prefix from key
      loopCount++;
    } while (cursor !== '0' && loopCount < 10000); // protection against infinite loop
    if (loopCount === 10000 && cursor !== '0')
      console.warn('getKeysByPrefix exceed looping protection');
    return keys;
  } catch (err) {
    console.error('getKeysByPrefix encountered error ', err);
  }
};

// declutter aged / obsolete channelinfo and chunk values on redis
// this should only be called after the counterpart methods cleanupRecordingStories and cleanupAudioChannels have been called
// to avoid unintentional data integrity corruption being introduced
const redisDeclutter = async (
  cleanupAge,
  declutterArchivePolicy = 'DELETE',
  cleanupTimepoint = ''
) => {
  try {
    console.log('redisDeclutter()');
    const channelInfoKeys = await getKeysByPrefix('channelinfo');
    await Promise.all(
      channelInfoKeys.map(key =>
        declutterRedisObject(
          'channelinfo',
          key,
          cleanupAge,
          declutterArchivePolicy,
          cleanupTimepoint,
          'application/json'
        )
      )
    );
    const chunkKeys = await getKeysByPrefix('chunk');
    await Promise.all(
      chunkKeys.map(key =>
        declutterRedisObject(
          'chunk',
          key,
          cleanupAge,
          declutterArchivePolicy,
          cleanupTimepoint
        )
      )
    );
    const storyTracksKeys = await getKeysByPrefix('storytracks');
    await Promise.all(
      storyTracksKeys.map(key =>
        declutterRedisObject(
          'storytracks',
          key,
          cleanupAge,
          declutterArchivePolicy,
          cleanupTimepoint
        )
      )
    );
    const chunkTimestampKeys = await getKeysByPrefix('timestamp:chunk');
    await Promise.all(
      chunkTimestampKeys.map(key => declutterTimestamp('chunk', key))
    );
    const channelInfoTimestampKeys = await getKeysByPrefix(
      'timestamp:channelinfo'
    );
    await Promise.all(
      channelInfoTimestampKeys.map(key =>
        declutterTimestamp('channelinfo', key)
      )
    );
    const storyTracksTimestampKeys = await getKeysByPrefix(
      'timestamp:storytracks'
    );
    await Promise.all(
      storyTracksTimestampKeys.map(key =>
        declutterTimestamp('storytracks', key)
      )
    );
  } catch (error) {
    console.error('redisDeclutter encountered error ', error);
  }
};

// if the timestamp doesn't have a matching object, then remove it
const declutterTimestamp = async (prefix, key) => {
  if ((await redisExistsPromise(`${prefix}:${key}`)) === 0)
    await redisDelWithPrefix(`timestamp:${prefix}`, key);
};

const declutterRedisObject = async (
  prefix,
  key,
  cleanupAge,
  declutterArchivePolicy,
  cleanupTimepoint,
  contentType = 'application/x-binary'
) => {
  const cleanupTimepointMoment = cleanupTimepoint
    ? moment(cleanupTimepoint)
    : moment();
  const timestampMoment = moment(await redisGetTimestamp(prefix, key));
  const objectAge = Math.abs(
    timestampMoment.diff(cleanupTimepointMoment, 'hours', false)
  );
  if (objectAge > cleanupAge) {
    console.warn(
      'declutterRedisObject decluttering aged object ',
      key,
      'with policy ',
      declutterArchivePolicy
    );
    if (declutterArchivePolicy === 'ARCHIVE') {
      // upload to the s3 declutter folder
      const { s3WriteStream, s3WritePromise } = s3UploadStreamPromise(
        process.env.OPERATIONAL_BUCKET,
        `${prefix}/${key}`,
        'declutter',
        contentType
      );
      s3WriteStream.end(await redisGetPromise(`${prefix}:${key}`));
      await s3WritePromise;
    }
    await redisDelWithPrefix(prefix, key);
  }
};

module.exports = {
  redisClient,
  redisSetPromise,
  redisGetPromise,
  redisSetChunk,
  redisGetChunk,
  redisGetTimestamp,
  redisSetChannelInfo,
  redisGetChannelInfo,
  redisSetStoryTracks,
  redisGetStoryTracks,
  redisDelPromise,
  redisDelWithPrefix,
  redisFlushAllPromise,
  redisPing,
  redisDeclutter,
  pipeReadStreamToRedisPromise,
  getKeysByPrefix,
  redisExistsPromise,
};
