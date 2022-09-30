import request from 'supertest';
import { Test } from 'supertest';
import { server, keystone, dropTestDB } from './server';
import { synchroniseContent } from '../src/services/content/ContentController';
import { defaultSyncs } from '../src/services/content/helpers/ContentSyncHelper';
import { getItems } from '../src/controllers/GQL';
import { emptyS3Bucket } from '../src/utils/AWSUtil';
import {
  testAudioData,
  testUserFields,
  testTopicMetadata,
} from './data/testData';
import { AUTO_TEST_ORG_IDENT } from './data/testData';
import {
  AudioChannelSampleRate,
  PublishStoryData,
} from '../src/ts/types/contentTypes';
import { MongoId, StoryMetadata } from '../src/ts/types/contentTypes';
import { v4 as uuid } from 'uuid';

export const createStory = (app, topicId: MongoId, authToken: string): Test => {
  return request(app)
    .post('/story/authed/stub')
    .set('Authorization', authToken)
    .send({ isPublic: true, topicId });
};

export const requestChannel = (
  app,
  storyId: MongoId,
  authToken: string,
  sampleRate = AudioChannelSampleRate.LOW,
  audioChannels = 1
): Test => {
  return request(app)
    .post('/audiochannel/authed/requestChannel')
    .set('Authorization', authToken)
    .send({
      storyId,
      sampleRate,
      audioChannels,
    });
};

export const upstream = (
  app,
  channelId: MongoId,
  chunkId: string,
  authToken: string,
  syncToDB = true,
  chunkMap: string[] = []
): Test => {
  return request(app)
    .post('/audiochannel/authed/upstream')
    .set('Authorization', authToken)
    .send({
      channelId,
      chunkId,
      syncToDB,
      chunk: { data: testAudioData },
      chunkMap,
      doChunkProcessing: false, // make sure serverless processing jobs are not fired for e2e tests
    });
};

export const upstreamChannelChunks = async (
  app,
  storyId: MongoId,
  responseObj,
  chunkCount: number,
  chunkDelay: number,
  sampleRate: number,
  audioChannels: number,
  authToken: string
): Promise<MongoId> => {
  const resp = await requestChannel(
    app,
    storyId,
    authToken,
    sampleRate,
    audioChannels
  );
  const channelId = resp.body.channelId;
  responseObj.channelId = channelId;
  responseObj.isChannelEmpty = false;
  responseObj.answerDuration = (chunkCount * chunkDelay) / 1000;
  let count = 0;
  const chunkMap = [];
  do {
    const syncToDB = count === chunkCount - 1;
    const chunkId = uuid();
    chunkMap.push(chunkId);
    await upstream(app, channelId, chunkId, authToken, syncToDB, chunkMap);
    await delay(chunkDelay);
    count++;
  } while (count < chunkCount);
  return channelId;
};

export const chunkId = (): string => {
  return uuid();
};

export const topicPlaybackMetadata = (
  app,
  topicId: MongoId,
  authToken: string
): Test => {
  return request(app)
    .get(`/topic/authed/playback/${topicId}`)
    .set('Authorization', authToken);
};

export const createStoryAndRetrieveMetadata = async (
  app,
  topicId: MongoId,
  authToken: string
): Promise<{ storyId: MongoId; metadata: StoryMetadata }> => {
  const response = await createStory(app, topicId, authToken);
  const storyId = response.body.id;

  const response2 = await topicPlaybackMetadata(app, topicId, authToken);
  const questions = response2.body;
  const responses = questions.map(question => {
    return {
      identifier: question.identifier,
      questionDuration: parseFloat(question.audioFile.duration),
      channelId: '',
      answerDuration: 0,
      isActiveResponse: false,
      isChannelEmpty: true,
    };
  });

  return {
    storyId,
    metadata: {
      responses,
    },
  };
};

// creates the specified number of channels and upstreams the specified number of chunks on each channel
export const editStory = async (
  app,
  storyId: MongoId,
  metadata: StoryMetadata,
  editQuestions,
  authToken: string,
  chunkCount = 1,
  mode = 'PARALLEL',
  seriesDelay = 0,
  sampleRate = AudioChannelSampleRate.LOW,
  audioChannels = 1
): Promise<MongoId[]> => {
  const { responses } = metadata;
  let channelIds: MongoId[];
  // get channel ids and set it against the requested question in the metadata
  const editResponseObjs = await Promise.all(
    editQuestions.map(async qIdent => {
      return responses.filter(q => q.identifier === qIdent)[0];
    })
  );

  // upstream the required number of chunks on each channel using specified mode
  switch (mode) {
    case 'SERIES':
      channelIds = [];
      for (const rObj of editResponseObjs) {
        channelIds.push(
          await upstreamChannelChunks(
            app,
            storyId,
            rObj,
            chunkCount,
            seriesDelay,
            sampleRate,
            audioChannels,
            authToken
          )
        );
        await delay(seriesDelay);
      }
      break;
    case 'PARALLEL':
    default:
      channelIds = await Promise.all(
        editResponseObjs.map(rObj => {
          return upstreamChannelChunks(
            app,
            storyId,
            rObj,
            chunkCount,
            seriesDelay,
            sampleRate,
            audioChannels,
            authToken
          );
        })
      );
      break;
  }
  return channelIds;
};

export const publishStory = (
  app,
  storyId: MongoId,
  storyData: PublishStoryData,
  authToken: string,
  skipFinalise = true
): Test => {
  return request(app)
    .put(`/story/authed/publish/${storyId}`)
    .set('Authorization', authToken)
    .send({
      storyData,
      skipFinalise,
    });
};

export const delay = ms => new Promise(res => setTimeout(res, ms, {}));
export const prereqs = async (
  setupServer = true,
  synchContent = true,
  syncTypes = defaultSyncs
) => {
  let app;
  if (setupServer) app = await server;
  if (synchContent) await synchroniseContent(AUTO_TEST_ORG_IDENT, syncTypes);
  return app;
};

export const signup = async (
  app,
  userFields = testUserFields,
  avatarPath = ''
): Promise<string> => {
  let response;
  if (avatarPath)
    response = await request(app)
      .post(`/user/signup/${AUTO_TEST_ORG_IDENT}`)
      .field('user', JSON.stringify(userFields))
      .attach('avatar', avatarPath);
  else
    response = await request(app)
      .post(`/user/signup/${AUTO_TEST_ORG_IDENT}`)
      .field('user', JSON.stringify(userFields));
  return response.headers.authtoken;
};
export const createTopic = async (
  app,
  metadata = testTopicMetadata
): Promise<MongoId> => {
  // need to get test org id and connect the test theme to this org

  const data = {
    query: `mutation AddTopic($metadata: String!) {
      createTopic(
        data: {
          title: "Test topic"
          theme: {
            create: { title: "Test theme" }
          }
          metadata: $metadata,
        } ) 
      {
        id
      }
      }`,
    variables: {
      metadata,
    },
  };
  const response = await request(app).post('/admin/api').send(data);
  return response.body.data.createTopic.id;
};

export const topicId = async (identifier = 'e2eb/TEST'): Promise<MongoId> => {
  return (
    await getItems(
      'Topic',
      {
        identifier,
      },
      'id'
    )
  )[0].id;
};

export const tagId = async (title = 'Test tag'): Promise<MongoId> => {
  return (
    await getItems(
      'Tag',
      {
        title,
      },
      'id'
    )
  )[0].id;
};

export const clearChannel = (
  app,
  channelId: MongoId,
  authToken: string
): Test => {
  return request(app)
    .post(`/audiochannel/authed/clearChannel`)
    .set('Authorization', authToken)
    .send({ channelId });
};

export const downstream = (app, channelId: MongoId): Test => {
  return request(app).get(`/audiochannel/downstream/channel/${channelId}`);
};

export const updateStory = (
  app,
  storyId: MongoId,
  storyDetails: StoryMetadata,
  authToken: string
): Test => {
  return request(app)
    .put(`/story/authed/update/${storyId}`)
    .set('Authorization', authToken)
    .send({ storyDetails });
};

export const likeStory = (app, storyId: MongoId, authToken: string): Test => {
  return request(app)
    .put('/story/authed/like')
    .set('Authorization', authToken)
    .send({ storyID: storyId });
};

export const unlikeStory = (app, storyId: MongoId, authToken: string): Test => {
  return request(app)
    .put('/story/authed/unlike')
    .set('Authorization', authToken)
    .send({ storyID: storyId });
};

export const saveStory = (
  app,
  storyId: MongoId,
  storyTitle: string,
  metadata: StoryMetadata,
  authToken: string,
  progress?: number
): Test => {
  return request(app)
    .put(`/story/authed/save/${storyId}`)
    .set('Authorization', authToken)
    .send({
      title: storyTitle,
      metadata,
      progress,
    });
};
export const restoreStory = (
  app,
  storyId: MongoId,
  authToken: string
): Test => {
  return request(app)
    .get(`/story/authed/restore/${storyId}`)
    .set('Authorization', authToken);
};
export const deleteStory = (app, storyId: MongoId, authToken: string): Test => {
  return request(app)
    .delete(`/story/authed/${storyId}`)
    .set('Authorization', authToken);
};
export const getStoryTracks = (app, storyId: MongoId): Test => {
  return request(app).get(`/story/${storyId}/tracks`);
};
export const getStoryHls = (app, storyId: MongoId): Test => {
  return request(app).get(`/story/${storyId}/hls`);
};
export const getPlayableItems = (app, tag: string, authToken: string): Test => {
  return request(app)
    .get(`/playableitems/authed/${tag}`)
    .set('Authorization', authToken);
};
export const teardown = async (
  done,
  app = null,
  throttle = false,
  throttleDelay = 60000
) => {
  try {
    if (throttle) await delay(throttleDelay);
    await dropTestDB();
    await emptyS3Bucket(process.env.TEST_OPERATIONAL_BUCKET);
    if (app) {
      app.close(async () => {
        await keystone.disconnect();
        done();
      });
    } else done();
  } catch (err) {
    console.error(err);
    done();
  }
};
export const cyclicStoryCreation = async (
  app,
  topicId: MongoId,
  authToken: string,
  testStoryTitle: string,
  stories = 10,
  chunksPerChannel = 10,
  questionLag = 5000
): Promise<MongoId[]> => {
  let storyIds: MongoId[] = [];
  try {
    for (let i = 0; i < stories; i++) {
      const { storyId, metadata } = await createStoryAndRetrieveMetadata(
        app,
        topicId,
        authToken
      );
      storyIds.push(storyId);
      const { responses } = metadata;

      // get an array of question identifiers for editing purposes
      const qIds = responses.reduce((qAcc, q) => {
        qAcc.push(q.identifier);
        return qAcc;
      }, []);

      await editStory(
        app,
        storyId,
        metadata,
        qIds,
        authToken,
        chunksPerChannel,
        'SERIES',
        questionLag
      );

      await publishStory(
        app,
        storyId,
        {
          title: testStoryTitle,
          isPublic: true,
          selectedTags: [],
          metadata,
          storyTellers: [],
          duration: '0',
        },
        authToken
      );
      await delay(questionLag);
    }
    return storyIds;
  } catch (err) {
    console.error('cyclicStoryCreation ', err);
  }
};

module.exports = {
  testAudioData,
  testTopicMetadata,
  testUserFields,
  delay,
  prereqs,
  signup,
  createTopic,
  topicId,
  topicPlaybackMetadata,
  tagId,
  createStory,
  createStoryAndRetrieveMetadata,
  requestChannel,
  clearChannel,
  upstream,
  downstream,
  editStory,
  publishStory,
  updateStory,
  likeStory,
  unlikeStory,
  saveStory,
  restoreStory,
  deleteStory,
  getStoryTracks,
  getStoryHls,
  getPlayableItems,
  teardown,
  cyclicStoryCreation,
  chunkId,
};
