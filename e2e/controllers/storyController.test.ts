import moment from 'moment';
import request from 'supertest';
import { objectExistsInS3Bucket } from '../../src/utils/AWSUtil';
import { cleanupRecordingStories } from '../../src/services/story/helpers/StoryLifecycleHelper';
import { getItem, getItems, updateItem } from '../../src/controllers/GQL';
import { dbAtTrackingTimeFormat } from '../../src/appConstants';
import { terminateStoryChannels } from '../../src/services/audiochannel/helpers/AudioChannelLifecycleHelper';
import {
  prereqs,
  delay,
  signup,
  topicId,
  tagId,
  createStory,
  createStoryAndRetrieveMetadata,
  editStory,
  publishStory,
  updateStory,
  saveStory,
  restoreStory,
  deleteStory,
  likeStory,
  unlikeStory,
  teardown,
} from '../../jest/e2eUtil';
import { redisGetChunk } from '../../src/utils/RedisUtil';
import {
  ContentTypes,
  DeclutterArchivePolicy,
} from '../../src/ts/types/contentTypes';

let testUserAuthToken,
  testStoryId,
  testStoryId2,
  testTopicId,
  testTagId,
  testStoryData,
  e2eTestUserId;

const testStoryFields = {
  title: 'test title',
  isPublic: false,
  tags: [],
  storyTellers: null,
  storyMetadata: '',
};

describe('Story controller tests', () => {
  let app;
  beforeAll(async () => {
    try {
      jest.setTimeout(180000); // this must be the first command, otherwise jest will not honour promises...
      app = await prereqs(true, true, [
        ContentTypes.Tag,
        ContentTypes.Theme,
        ContentTypes.Topic,
        ContentTypes.Question,
        ContentTypes.User,
      ]);
      testUserAuthToken = await signup(app);
      testTopicId = await topicId();
      testTagId = await tagId();

      // set e2eTestUserId
      const data = {
        query: `query User($emailAddress: String!){
          allUsers(where: 
            {
              emailAddress: $emailAddress
            }
          )
          {
            id
          }
        }`,
        variables: {
          emailAddress: 'e2e@user.com', // as defined in all-content-sync-e2e-backend
        },
      };

      const response = await request(app).post('/admin/api').send(data);
      const allUserIds = response.body.data.allUsers;
      e2eTestUserId = allUserIds[0].id;
    } catch (err) {
      console.log(err);
    }
  });

  describe('Story workflow', () => {
    test('Should successfully create story stub', async () => {
      const response = await createStory(app, testTopicId, testUserAuthToken);
      expect(response.statusCode).toBe(200);
      testStoryId = response.body.id;
    });

    test('Should update story details with changed title, isPublic and storytellers', async () => {
      testStoryFields.tags.push(testTagId);
      testStoryFields.title = 'Changed';
      testStoryFields.isPublic = false;

      const storyDetails = testStoryFields;
      storyDetails.storyTellers = [e2eTestUserId];
      const response = await updateStory(
        app,
        testStoryId,
        // @ts-ignore
        storyDetails,
        testUserAuthToken
      );
      expect(response.statusCode).toBe(200);
      expect(response.body.title).toBe(storyDetails.title);
      expect(response.body.isPublic).toBe(storyDetails.isPublic);
      expect(response.body.storyTellers.length).toBe(1);
      expect(response.body.storyTellers[0].username).toBe('e2euser');
    });

    test('Should edit then publish test story -- published progress should be 100', async () => {
      // create a new story and get the metadata for editing
      const result = await createStoryAndRetrieveMetadata(
        app,
        testTopicId,
        testUserAuthToken
      );
      testStoryId2 = result.storyId;
      const metadata = result.metadata;
      await editStory(
        app,
        testStoryId2,
        metadata,
        ['e2eb/TEST/SHQ1', 'e2eb/TEST/SHQ2', 'e2eb/TEST/SHQ3'],
        testUserAuthToken,
        5
      );
      testStoryData = {
        title: 'Test story',
        metadata,
        isPublic: true,
        selectedTags: [testTagId],
        storyTellers: [e2eTestUserId],
      };
      const response2 = await publishStory(
        app,
        testStoryId2,
        testStoryData,
        testUserAuthToken
      );
      expect(response2.statusCode).toBe(200);
      expect(response2.body.storyTellers.length).toBe(1);
      expect(response2.body.storyTellers[0].username).toBe('e2euser');
      const publishedStory = await getItem(
        'Story',
        testStoryId2,
        `id
        status
        audioChannels {
          id
          status
        }
        progress`
      );
      expect(publishedStory.status).toBe('PUBLISHED');
      expect(publishedStory.progress).toBe(100);
    });
  });
  describe('Story likes', () => {
    test('Should like test story', async () => {
      const response = await likeStory(app, testStoryId, testUserAuthToken);
      expect(response.statusCode).toBe(200);
      const response2 = await request(app)
        .get(`/story/authed/${testStoryId}`)
        .set('Authorization', testUserAuthToken);
      expect(response2.statusCode).toBe(200);
      expect(response2.body.likes).toBe(1);
    });

    test('Should return one liked stories', async () => {
      const response = await request(app)
        .get('/user/authed/stories/liked')
        .set('Authorization', testUserAuthToken);

      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBe(1);
    });

    test('Should unlike test story', async () => {
      const response = await unlikeStory(app, testStoryId, testUserAuthToken);
      expect(response.statusCode).toBe(200);
      const response2 = await request(app)
        .get(`/story/authed/${testStoryId}`)
        .set('Authorization', testUserAuthToken);
      expect(response2.statusCode).toBe(200);
      expect(response2.body.likes).toBe(0);
    });

    test('Should return no stories if user has not liked any', async () => {
      const response = await request(app)
        .get('/user/authed/stories/liked')
        .set('Authorization', testUserAuthToken);

      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBe(0);
    });
  });

  describe('User published stories', () => {
    test('Should get user stories with theme and stories wrapped in transfer object', async () => {
      const response = await request(app)
        .get('/user/authed/stories/published/bytheme')
        .set('Authorization', testUserAuthToken);
      expect(response.statusCode).toBe(200);
      const themesStories = response.body;
      expect(themesStories.length).toBe(1);
      expect(themesStories[0].title).toBe('Your life story'); // as defined in e2e_backend content sync sheet
      expect(themesStories[0].data.length).toBe(1);
      expect(themesStories[0].data[0].title).toBe('Test story');
    });
  });

  describe('Cleanup recording stories', () => {
    test('Cleanup should not cleanup story where story is not aged', async () => {
      // initial -- the first story created should still be there unpublished
      const initialRecStories = await getItems(
        'Story',
        {
          status: 'RECORDING',
        },
        'id'
      );
      expect(initialRecStories.length).toBe(1);
      // simulate running a cleanup stories 3 hrs hence, with cleanupAge set to 12 hrs
      const checkTimePoint = moment()
        .add(3, 'hours')
        .format(dbAtTrackingTimeFormat);
      await cleanupRecordingStories(
        12,
        DeclutterArchivePolicy.DELETE,
        checkTimePoint
      );
      const finalRecStories = await getItems(
        'Story',
        {
          status: 'RECORDING',
        },
        `id
      status
      audioChannels {
        id
        status
      }`
      );
      expect(finalRecStories.length).toBe(1);
      const recStory = finalRecStories[0];
      expect(recStory.status).toBe('RECORDING');
      expect(recStory.audioChannels.length).toBe(0);

      // now terminate the story
      await terminateStoryChannels(testStoryId);
      await updateItem(
        'Story',
        recStory.id,
        {
          status: 'DELETED',
        },
        'id'
      );
    });

    test('Cleanup should clean recording stories where story is aged', async () => {
      // initial check we have no recording stories
      const initialRecStories = await getItems(
        'Story',
        {
          status: 'RECORDING',
        },
        'id'
      );
      expect(initialRecStories.length).toBe(0);

      // set up a story, do some recording, then abandon it
      const {
        storyId: thisTestStoryId,
        metadata,
      } = await createStoryAndRetrieveMetadata(
        app,
        testTopicId,
        testUserAuthToken
      );
      await editStory(
        app,
        thisTestStoryId,
        metadata,
        ['e2eb/TEST/SHQ1', 'e2eb/TEST/SHQ2', 'e2eb/TEST/SHQ3'],
        testUserAuthToken,
        5
      );

      // simulate running a cleanup stories 1 day hence, with cleanupAge set to 12 hrs
      const checkTimePoint = moment()
        .add(1, 'days')
        .format(dbAtTrackingTimeFormat);
      await cleanupRecordingStories(
        12,
        DeclutterArchivePolicy.DELETE,
        checkTimePoint
      );

      const finalRecStories = await getItems(
        'Story',
        {
          status: 'RECORDING',
        },
        `id
      status
      audioChannels {
        id
        status
      }`
      );
      expect(finalRecStories.length).toBe(0);

      const finalTestStory = await getItem(
        'Story',
        thisTestStoryId,
        `id
      status
      audioChannels {
        id
        status
      }`
      );
      expect(finalTestStory.status).toBe('DELETED');
      expect(finalTestStory.audioChannels.length).toBe(3);
      expect(finalTestStory.audioChannels[0].status).toBe('DELETED');
    });
  });

  describe('Saved story functionality', () => {
    test('Should save test story with story status updated and chunks moved to S3', async () => {
      const {
        storyId: thisTestStoryId,
        metadata,
      } = await createStoryAndRetrieveMetadata(
        app,
        testTopicId,
        testUserAuthToken
      );
      await editStory(
        app,
        thisTestStoryId,
        metadata,
        ['e2eb/TEST/SHQ1', 'e2eb/TEST/SHQ2', 'e2eb/TEST/SHQ3'],
        testUserAuthToken,
        5
      );
      const response = await saveStory(
        app,
        thisTestStoryId,
        'Test save',
        metadata,
        testUserAuthToken,
        50
      );
      expect(response.statusCode).toBe(200);
      const savedStory = await getItem(
        'Story',
        thisTestStoryId,
        `id
      status
      title
      audioChannels {
        id
        status
        chunks
      }
      progress`
      );
      expect(savedStory.status).toBe('SAVED');
      expect(savedStory.title).toBe('Test save');
      expect(savedStory.progress).toBe(50);
      // check channels set to SAVED and chunks removed from Redis and uploaded to s3
      for (const channel of savedStory.audioChannels) {
        expect(channel.status).toBe('SAVED');
        const chunks = JSON.parse(channel.chunks);
        for (const chunk of chunks) {
          const chunkOnRedis = await redisGetChunk(chunk.chunkId);
          expect(chunkOnRedis).toBeFalsy();
          const chunkOnS3 = await objectExistsInS3Bucket(
            process.env.OPERATIONAL_BUCKET,
            `saved/${channel.id}/${chunk.chunkId}`
          );
          expect(chunkOnS3).toBe(true);
        }
      }
    });
    test('Should restore test story with status updated and chunks moved back to redis', async () => {
      const testSampleRate = 16000;
      const {
        storyId: thisTestStoryId,
        metadata,
      } = await createStoryAndRetrieveMetadata(
        app,
        testTopicId,
        testUserAuthToken
      );
      await editStory(
        app,
        thisTestStoryId,
        metadata,
        ['e2eb/TEST/SHQ1', 'e2eb/TEST/SHQ2', 'e2eb/TEST/SHQ3'],
        testUserAuthToken,
        5,
        'PARALLEL',
        0,
        testSampleRate
      );
      await saveStory(
        app,
        thisTestStoryId,
        'Test save',
        metadata,
        testUserAuthToken,
        35
      );
      const response = await restoreStory(
        app,
        thisTestStoryId,
        testUserAuthToken
      );
      expect(response.statusCode).toBe(200);
      const restoredStory = await getItem(
        'Story',
        thisTestStoryId,
        `id
      status
      audioChannels {
        id
        status
        chunks
        sampleRate
      }
      progress`
      );
      expect(restoredStory.status).toBe('RECORDING');
      expect(restoredStory.progress).toBe(35);
      // check channels set to RECORDING and chunks removed from S3 and restored to Redis
      for (const channel of restoredStory.audioChannels) {
        expect(channel.status).toBe('RECORDING');
        const chunks = JSON.parse(channel.chunks);
        for (const chunk of chunks) {
          const chunkOnRedis = await redisGetChunk(chunk.chunkId);
          expect(chunkOnRedis).not.toBeFalsy();
          const chunkOnS3 = await objectExistsInS3Bucket(
            process.env.OPERATIONAL_BUCKET,
            `saved/${channel.id}/${chunk.chunkId}`
          );
          expect(chunkOnS3).toBe(false);
        }
      }
      // check sample rate is returned
      const sampleRate = response.body.sampleRate;
      expect(sampleRate).toBe(testSampleRate);
    });
  });
  describe('Delete story', () => {
    test('Should delete recording test story status set to DELETED, chunks removed from redis and streaming info deleted', async () => {
      const {
        storyId: uniqueTestStoryId,
        metadata,
      } = await createStoryAndRetrieveMetadata(
        app,
        testTopicId,
        testUserAuthToken
      );
      await editStory(
        app,
        uniqueTestStoryId,
        metadata,
        ['e2eb/TEST/SHQ1', 'e2eb/TEST/SHQ2', 'e2eb/TEST/SHQ3'],
        testUserAuthToken,
        5
      );
      await delay(5000); // this is necessary to make sure stream chunks are uploaded before we delete
      const response = await deleteStory(
        app,
        uniqueTestStoryId,
        testUserAuthToken
      );
      expect(response.statusCode).toBe(200);
      const deletedStory = await getItem(
        'Story',
        uniqueTestStoryId,
        `id
      status
      audioChannels {
        id
        status
        chunks
      }`
      );
      expect(deletedStory.status).toBe('DELETED');
      // check channels set to DELETED and chunks removed from S3 stream and redis
      for (const channel of deletedStory.audioChannels) {
        expect(channel.status).toBe('DELETED');
        const chunks = JSON.parse(channel.chunks);
        for (const chunk of chunks) {
          const chunkOnRedis = await redisGetChunk(chunk.chunkId);
          expect(chunkOnRedis).toBeFalsy();
          const chunkOnS3 = await objectExistsInS3Bucket(
            process.env.OPERATIONAL_BUCKET,
            `stream/${channel.id}/${chunk.chunkId}.mp3`
          );
          expect(chunkOnS3).toBe(false);
        }
      }
    });

    test('Should delete saved test story', async () => {
      const {
        storyId: uniqueTestStoryId,
        metadata,
      } = await createStoryAndRetrieveMetadata(
        app,
        testTopicId,
        testUserAuthToken
      );
      await editStory(
        app,
        uniqueTestStoryId,
        metadata,
        ['e2eb/TEST/SHQ1', 'e2eb/TEST/SHQ2', 'e2eb/TEST/SHQ3'],
        testUserAuthToken,
        5
      );
      await delay(5000); // this is necessary to make sure stream chunks are uploaded before we delete
      await saveStory(
        app,
        uniqueTestStoryId,
        'Test save',
        metadata,
        testUserAuthToken
      );
      const response = await deleteStory(
        app,
        uniqueTestStoryId,
        testUserAuthToken
      );
      expect(response.statusCode).toBe(200);
      const deletedStory = await getItem(
        'Story',
        uniqueTestStoryId,
        `id
      status
      audioChannels {
        id
        status
        chunks
      }`
      );
      expect(deletedStory.status).toBe('DELETED');
      // check channels set to DELETED and chunks removed from S3 stream and redis
      for (const channel of deletedStory.audioChannels) {
        expect(channel.status).toBe('DELETED');
        const chunks = JSON.parse(channel.chunks);
        for (const chunk of chunks) {
          const chunkOnRedis = await redisGetChunk(chunk.chunkId);
          expect(chunkOnRedis).toBeFalsy();
          const chunkOnS3Stream = await objectExistsInS3Bucket(
            process.env.OPERATIONAL_BUCKET,
            `stream/${channel.id}/${chunk.chunkId}.mp3`
          );
          expect(chunkOnS3Stream).toBe(false);
          const chunkOnS3Saved = await objectExistsInS3Bucket(
            process.env.OPERATIONAL_BUCKET,
            `saved/${channel.id}/${chunk.chunkId}`
          );
          expect(chunkOnS3Saved).toBe(false);
        }
      }
    });

    test('Should delete published test story', async () => {
      const {
        storyId: uniqueTestStoryId,
        metadata,
      } = await createStoryAndRetrieveMetadata(
        app,
        testTopicId,
        testUserAuthToken
      );
      await editStory(
        app,
        uniqueTestStoryId,
        metadata,
        ['e2eb/TEST/SHQ1', 'e2eb/TEST/SHQ2', 'e2eb/TEST/SHQ3'],
        testUserAuthToken,
        5
      );
      await delay(5000); // this is necessary to make sure stream chunks are uploaded before we delete
      const thisTestStoryData = {
        title: 'Test story',
        metadata,
        isPublic: true,
        selectedTags: [testTagId],
        storyTellers: [],
        duration: '0',
      };
      await publishStory(
        app,
        uniqueTestStoryId,
        thisTestStoryData,
        testUserAuthToken
      );
      const response = await deleteStory(
        app,
        uniqueTestStoryId,
        testUserAuthToken
      );
      expect(response.statusCode).toBe(200);
      const deletedStory = await getItem(
        'Story',
        uniqueTestStoryId,
        `id
      status
      audioChannels {
        id
        status
        chunks
      }`
      );
      expect(deletedStory.status).toBe('DELETED');
      // check channels set to DELETED and chunks removed from S3 stream and redis
      for (const channel of deletedStory.audioChannels) {
        expect(channel.status).toBe('DELETED');
        const chunks = JSON.parse(channel.chunks);
        for (const chunk of chunks) {
          const chunkOnRedis = await redisGetChunk(chunk.chunkId);
          expect(chunkOnRedis).toBeFalsy();
          const chunkOnS3Stream = await objectExistsInS3Bucket(
            process.env.OPERATIONAL_BUCKET,
            `stream/${channel.id}/${chunk.chunkId}.mp3`
          );
          expect(chunkOnS3Stream).toBe(false);
        }
      }
    });
  });

  afterAll(async done => {
    await teardown(done, app);
  });
});
