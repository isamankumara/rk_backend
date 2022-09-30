import { testTopicMetadata } from '../../jest/data/testData';
import request from 'supertest';
import { cyclicStoryCreation, signup } from '../../jest/e2eUtil';
import {
  deleteTestedAudioChannels,
  deleteTestUsers,
  deleteTestStories,
  deleteTestThemes,
  deleteTestTopics,
} from '../../jest/testCleardownUtil';
import { s3GetObjectReadStream } from '../../src/utils/AWSUtil';
import {
  rimrafPromise,
  mkDirPromise,
  readStreamToFile,
} from '../../src/utils/FileUtil';
import { MongoId } from '../../src/ts/types/contentTypes';

const {
  CONCURRENCY,
  BACKEND_BASE_ROUTE,
  REPEATS,
  STORIES_PER_CYCLE,
  CHUNKS_PER_CHANNEL,
  CHUNK_DELAY_MILLISECONDS,
} = process.env;
const app = BACKEND_BASE_ROUTE;
const concurrency = CONCURRENCY ? CONCURRENCY : 10;
const repeats = REPEATS ? REPEATS : 20;
const storiesPerCycle = parseInt(STORIES_PER_CYCLE, 10)
  ? parseInt(STORIES_PER_CYCLE, 10)
  : 10;
const chunksPerChannel = parseInt(CHUNKS_PER_CHANNEL, 10)
  ? parseInt(CHUNKS_PER_CHANNEL, 10)
  : 10;
const chunkDelayMilliseconds = parseInt(CHUNK_DELAY_MILLISECONDS, 10)
  ? parseInt(CHUNK_DELAY_MILLISECONDS, 10)
  : 1000;

let testTopicId: MongoId,
  authTokens: string[],
  testOrgId: MongoId,
  createdStoryIds: MongoId[] = [];
const userFields: {
  firstName: string;
  lastName: string;
  emailAddress: string;
  username: string;
  mobileNumber: string;
  password: string;
}[] = [];
const testThemeTitle = 'Load test theme !@#$%^&*()';
const testTopicTitle = 'Load test topic !@#$%^&*()';
const testStoryTitle = 'Load test story !@#$%^&*()';

describe('Story load tests', () => {
  beforeAll(async () => {
    jest.setTimeout(90000000);
    // prepare test user avatar image
    await rimrafPromise('/tmp/loadTest');
    await mkDirPromise('/tmp/loadTest');
    const testImageReadStream = s3GetObjectReadStream(
      process.env.TEST_MEDIA_ASSET_SOURCE_BUCKET,
      'testImage.jpg',
      'none'
    );
    await readStreamToFile(testImageReadStream, '/tmp/loadTest/testImage.jpg');

    // get test org id
    const data0 = {
      query: `query {
          allOrganisations(where: 
            {
              identifier: "E2E_BACKEND"
            }
          )
          {
            id
          }
        }`,
    };
    const response0 = await request(app).post('/admin/api').send(data0);
    testOrgId = response0.body.data.allOrganisations[0].id;

    // create test topic and get id
    try {
      const data = {
        query: `mutation AddTopic($metadata: String!){
          createTopic( 
            data: 
            { 
              identifier: "e2eb/LOAD_TEST_TOPIC",
              title: "${testTopicTitle}",
              duration: "1",
              metadata: $metadata,
              theme: {
                create: { 
                  identifier: "e2eb/LOAD_TEST_THEME",
                  title: "${testThemeTitle}",
                  organisation: {
                    connect: {
                      id: "${testOrgId}"
                    }
                  }
                }
              }
            }
          ) {
            id
          }
        }`,
        variables: {
          metadata: testTopicMetadata,
        },
      };

      const response = await request(app).post('/admin/api').send(data);
      testTopicId = response.body.data.createTopic.id;

      // create user fields to be used in the test run
      for (let i = 0; i < concurrency; i++) {
        const random = Math.floor(Math.random() * 100000000 + 1);
        userFields.push({
          firstName: 'Test',
          lastName: `User${i}`,
          emailAddress: `testuser${random}@test.com`,
          username: `testuser${random}`,
          mobileNumber: '12345678',
          password: '12345678',
        });
      }
    } catch (err) {
      console.error('Load test beforeAll error ', err);
    }
  });

  test('Signup batch users', async () => {
    authTokens = await Promise.all(
      userFields.map(user => {
        return signup(app, user, '/tmp/loadTest/testImage.jpg');
      })
    );
  });

  test('Cyclic story creation', async () => {
    let storyIdGroups: MongoId[][];
    for (let i = 0; i < repeats; i++) {
      storyIdGroups = await Promise.all(
        authTokens.map(authToken => {
          return cyclicStoryCreation(
            app,
            testTopicId,
            authToken,
            testStoryTitle,
            storiesPerCycle, // number of stories in the cycle
            chunksPerChannel, // upstream chunks per channel
            chunkDelayMilliseconds // ms delay after each chunk upload
          );
        })
      );
      for (const storyIdGroup of storyIdGroups)
        createdStoryIds.push(...storyIdGroup);
      console.warn(`Published ${createdStoryIds.length} stories`);
    }
  });

  afterAll(async () => {
    try {
      await deleteTestedAudioChannels(createdStoryIds, app);
      await Promise.all(
        userFields.map(userField =>
          deleteTestUsers(userField.emailAddress, app)
        )
      );
      await deleteTestTopics(testTopicTitle, app);
      await deleteTestThemes(testThemeTitle, app);
      await deleteTestStories(testStoryTitle, app);
    } catch (err) {
      console.error('load test afterAll error ', err);
    }
  });
});
