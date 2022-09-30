// All integration tests
import request from 'supertest';
import {
  publishStory,
  likeStory,
  clearChannel,
  unlikeStory,
  saveStory,
  restoreStory,
  deleteStory,
  createStoryAndRetrieveMetadata,
  editStory,
  downstream,
  getStoryTracks,
} from '../jest/e2eUtil';
import {
  deleteTestedAudioChannels,
  deleteTestUsers,
  deleteTestTopics,
  deleteTestThemes,
  deleteTestStories,
} from '../jest/testCleardownUtil';
import { AUTO_TEST_ORG_IDENT, testTopicMetadata } from '../jest/data/testData';
// Integration testing prerequisites:
// requires e2eb org to exist and have content synched
const { VERSION, BACKEND_BASE_ROUTE } = process.env;
const deriveBaseRoute = () => {
  if (VERSION) {
    const baseRouteParts = BACKEND_BASE_ROUTE?.split('//');
    return `${baseRouteParts[0]}//${VERSION}-dot-${baseRouteParts[1]}`;
  } else return BACKEND_BASE_ROUTE;
};
const backendBaseRoute = deriveBaseRoute();

const testUserEmail = 'integrationtest@test.com';
const testUserPassword = '12345678';
const testThemeTitle = 'Integration test theme !@#$%^&*()';
const testTopicTitle = 'Integration test topic !@#$%^&*()';
const testStoryTitle = 'Integration test story !@#$%^&*()';
let testTopicId: string,
  testChannelIds,
  testMetadata,
  testStoryId: string,
  saveRestoreDeleteStoryId,
  testOrgId: string,
  testUserAuthToken: string;

describe('Integration tests', () => {
  beforeAll(async () => {
    jest.setTimeout(30000);

    try {
      // delete any pre-existing integration test content
      await deleteTestUsers(testUserEmail, backendBaseRoute);
      await deleteTestTopics(testTopicTitle, backendBaseRoute);
      await deleteTestThemes(testThemeTitle, backendBaseRoute);
      await deleteTestStories(testStoryTitle, backendBaseRoute);

      // get test org id
      const data0 = {
        query: `query {
          allOrganisations(where: 
            {
              identifier: "${AUTO_TEST_ORG_IDENT}"
            }
          )
          {
            id
          }
        }`,
      };
      const response0 = await request(backendBaseRoute)
        .post('/admin/api')
        .send(data0);
      testOrgId = response0.body.data.allOrganisations[0].id;

      // create test topic and get id
      const data = {
        query: `mutation AddTopic($metadata: String!, $testTopicTitle: String!, $testThemeTitle: String!){
          createTopic( 
            data: 
              { 
                identifier: $testTopicTitle,
                title: $testTopicTitle,
                duration: "1",
                metadata: $metadata,
                theme: {
                  create: { 
                    identifier: $testThemeTitle,
                    title: $testThemeTitle,
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
            theme {
              id
            }
          }
        }`,
        variables: {
          metadata: testTopicMetadata,
          testTopicTitle,
          testThemeTitle,
        },
      };

      const response = await request(backendBaseRoute)
        .post('/admin/api')
        .send(data);

      testTopicId = response.body.data.createTopic.id;

      // create test user
      const data2 = {
        query: `mutation AddUser($emailAddress: String!, $password: String!){
          createUser( 
            data: 
              { 
                firstName: "Integration",
                lastName: "Test",
                username: "integrationtest",
                emailAddress: $emailAddress,
                password: $password,
                organisation: {
                  connect: {
                    id: "${testOrgId}"
                  }
                }
              }
          ) {
            id
          }
        }`,
        variables: {
          emailAddress: testUserEmail,
          password: testUserPassword,
        },
      };

      await request(backendBaseRoute).post('/admin/api').send(data2);
    } catch (err) {
      console.error('Integration test beforeAll error ', err);
    }
  });

  test('Login test user', async () => {
    const response = await request(backendBaseRoute).post(`/user/login`).send({
      emailAddress: testUserEmail,
      password: testUserPassword,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.userData.emailAddress).toBe(testUserEmail);
    console.log(response.body);
    console.log(response.headers.authtoken);
    testUserAuthToken = response.headers.authtoken;
    response.body.userData;
  });

  test('Create story stub', async () => {
    const response = await createStoryAndRetrieveMetadata(
      backendBaseRoute,
      testTopicId,
      testUserAuthToken
    );
    testStoryId = response.storyId;
    testMetadata = response.metadata;
    expect(typeof testStoryId).toBe('string');
    expect(typeof testMetadata).toBe('object');
  });

  test('Edit story -- upload audio on multiple channels', async () => {
    testChannelIds = await editStory(
      backendBaseRoute,
      testStoryId,
      testMetadata,
      ['e2eb/TEST/SHQ1', 'e2eb/TEST/SHQ2', 'e2eb/TEST/SHQ3'],
      testUserAuthToken,
      2
    );
    expect(testChannelIds.length).toBe(3);
  });

  test('Downstream HLS', async () => {
    const response = await downstream(backendBaseRoute, testChannelIds[0]);
    expect(response.statusCode).toBe(200);
    const response2 = await downstream(backendBaseRoute, testChannelIds[1]);
    expect(response2.statusCode).toBe(200);
    const response3 = await downstream(backendBaseRoute, testChannelIds[2]);
    expect(response3.statusCode).toBe(200);
  });
  test('Clear channel', async () => {
    const response = await clearChannel(
      backendBaseRoute,
      testChannelIds[2],
      testUserAuthToken
    );
    expect(response.statusCode).toBe(200);
  });
  test('Publish test story', async () => {
    const response = await publishStory(
      backendBaseRoute,
      testStoryId,
      {
        title: testStoryTitle,
        isPublic: true,
        selectedTags: [],
        metadata: testMetadata,
        duration: '12',
        storyTellers: [],
      },
      testUserAuthToken
    );
    expect(response.statusCode).toBe(200);
  });
  test('Get story tracks for published story', async () => {
    const response = await getStoryTracks(backendBaseRoute, testStoryId);
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(1);
  });

  test('Like test story', async () => {
    const response = await likeStory(
      backendBaseRoute,
      testStoryId,
      testUserAuthToken
    );
    expect(response.statusCode).toBe(200);

    const response2 = await request(backendBaseRoute)
      .get(`/story/authed/${testStoryId}`)
      .set('Authorization', testUserAuthToken);

    expect(response2.statusCode).toBe(200);
  });

  test('Unlike test story', async () => {
    const response = await unlikeStory(
      backendBaseRoute,
      testStoryId,
      testUserAuthToken
    );
    expect(response.statusCode).toBe(200);

    const response2 = await request(backendBaseRoute)
      .get(`/story/authed/${testStoryId}`)
      .set('Authorization', testUserAuthToken);

    expect(response2.statusCode).toBe(200);
  });

  test('Get all public stories', async () => {
    const response = await request(backendBaseRoute)
      .get(`/search/authed/allpublicstories/${0}`)
      .set('Authorization', testUserAuthToken);

    expect(response.statusCode).toBe(200);
  });

  test('Create and save a story', async () => {
    const { storyId, metadata } = await createStoryAndRetrieveMetadata(
      backendBaseRoute,
      testTopicId,
      testUserAuthToken
    );
    await editStory(
      backendBaseRoute,
      storyId,
      metadata,
      ['e2eb/TEST/SHQ1', 'e2eb/TEST/SHQ2', 'e2eb/TEST/SHQ3'],
      testUserAuthToken,
      5
    );
    const response = await saveStory(
      backendBaseRoute,
      storyId,
      testStoryTitle,
      metadata,
      testUserAuthToken
    );
    expect(response.statusCode).toBe(200);
    saveRestoreDeleteStoryId = storyId;
  });

  test('Restore story', async () => {
    const response = await restoreStory(
      backendBaseRoute,
      saveRestoreDeleteStoryId,
      testUserAuthToken
    );
    expect(response.statusCode).toBe(200);
  });

  test('Delete story', async () => {
    const response = await deleteStory(
      backendBaseRoute,
      saveRestoreDeleteStoryId,
      testUserAuthToken
    );
    expect(response.statusCode).toBe(200);
  });

  afterAll(async () => {
    try {
      await deleteTestedAudioChannels(
        [testStoryId, saveRestoreDeleteStoryId],
        backendBaseRoute
      );
      await deleteTestUsers(testUserEmail, backendBaseRoute);
      await deleteTestTopics(testTopicTitle, backendBaseRoute);
      await deleteTestThemes(testThemeTitle, backendBaseRoute);
      await deleteTestStories(testStoryTitle, backendBaseRoute);
    } catch (err) {
      console.error('integration test afterAll error ', err);
    }
  });
});
