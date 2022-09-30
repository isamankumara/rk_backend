// All integration tests
import loadtest from 'loadtest';
import request from 'supertest';
import { testAudioData } from '../../jest/data/testData';
import { AUTO_TEST_ORG_IDENT } from '../../jest/data/testData';

// loadtest default config parameters
const maxSeconds = 10;
const concurrency = 10;
const maxRequests = 1000;

// Load testing prerequisites:
// 1) User testuser test@test.com 12345678 exists in DB
// 2) Topic "Integration test topic" exists in DB

const { VERSION, BACKEND_BASE_ROUTE } = process.env;

const deriveBaseRoute = () => {
  if (VERSION) {
    const baseRouteParts = BACKEND_BASE_ROUTE.split('//');
    return `${baseRouteParts[0]}//${VERSION}-dot-${baseRouteParts[1]}`;
  } else return BACKEND_BASE_ROUTE;
};
const backendBaseRoute = deriveBaseRoute();

const testUserEmail = 'test@test.com';
const testUserPassword = '12345678';
let testTopicId, testStoryId, testChannelId, testUserAuthToken, testUserId;

const loadTestPromise = async options => {
  return new Promise((resolve, reject) => {
    loadtest.loadTest(options, function (error, result) {
      if (error) {
        return reject(error);
      }
      return resolve(result);
    });
  });
};

describe('Load tests', () => {
  beforeAll(async () => {
    jest.setTimeout(30000);
    // create test user
    const data0 = {
      query: `mutation AddUser($emailAddress: String!, $password: String!){
        createUser( 
          data: 
            { 
              firstName: "Integration",
              lastName: "Test",
              username: "integrationtest",
              emailAddress: $emailAddress,
              password: $password,
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

    const response0 = await request(backendBaseRoute)
      .post('/admin/api')
      .send(data0);
    testUserId = response0.body.data.createUser.id;

    // get testUserAuthToken and testUserData
    const response = await request(backendBaseRoute)
      .post(`/user/login/${AUTO_TEST_ORG_IDENT}`)
      .send({
        emailAddress: testUserEmail,
        password: testUserPassword,
      });
    testUserAuthToken = response.headers.authtoken;

    // create test topic and get id
    const data1 = {
      query: `mutation AddTopic($metadata: String!){
        createTopic( 
          data: 
            { 
              title: "Integration test topic",
              duration: "1",
              metadata: $metadata,
            }
        ) {
          id
        }
      }`,
      variables: {
        metadata: '["SHQ1","SHQ2"]',
      },
    };

    const response1 = await request(backendBaseRoute)
      .post('/admin/api')
      .send(data1);

    console.log('got ', response1.body.data.createTopic);
    testTopicId = response1.body.data.createTopic.id;

    // get test story id
    const response2 = await request(backendBaseRoute)
      .post('/story/stub')
      .set('Authorization', testUserAuthToken)
      .send({ isPublic: true, topicId: testTopicId });

    testStoryId = response2.body.id;
  });

  test('Login incorrect credentials loadtest', async () => {
    const options = {
      url: `${backendBaseRoute}/login`,
      method: 'POST',
      body: {
        emailAddress: 'notexist@test.com',
        password: 'notexist',
      },
      contentType: 'application/json',
      maxSeconds,
      concurrency,
      maxRequests,
    };

    console.log('Login failure loadtest console output');
    try {
      const result = await loadTestPromise(options);
      console.log(result);
    } catch (err) {
      expect(true).toBe(false);
      console.log(err);
    }
  });

  test('Login correct credentials loadtest', async () => {
    const options = {
      url: `${backendBaseRoute}/login`,
      method: 'POST',
      body: {
        emailAddress: testUserEmail,
        password: testUserPassword,
      },
      contentType: 'application/json',
      maxSeconds,
      concurrency,
      maxRequests,
    };
    console.log('Login correct credentials loadtest console output');
    try {
      const result = await loadTestPromise(options);
      console.log(result);
    } catch (err) {
      expect(true).toBe(false);
      console.log(err);
    }
  });

  test('Create story stub loadtest', async () => {
    const options = {
      url: `${backendBaseRoute}/story/stub`,
      headers: {
        Authorization: testUserAuthToken,
      },
      method: 'POST',
      body: {
        isPublic: true,
        topicId: testTopicId,
      },
      contentType: 'application/json',
      maxSeconds,
      concurrency,
      maxRequests,
    };
    console.log('Create story stub loadtest console output');
    try {
      const result = await loadTestPromise(options);
      console.log(result);
    } catch (err) {
      expect(true).toBe(false);
      console.log(err);
    }
  });

  test('Request channel loadtest', async () => {
    const options = {
      url: `${backendBaseRoute}/audioChannel/requestChannel`,
      method: 'POST',
      body: {
        storyId: testStoryId,
        sampleRate: 16000,
      },
      contentType: 'application/json',
      maxSeconds,
      concurrency,
      maxRequests,
    };
    console.log('Request channel loadtest console output');
    try {
      const result = await loadTestPromise(options);
      console.log(result);
    } catch (err) {
      expect(true).toBe(false);
      console.log(err);
    }

    // get a channel id for use in the next test
    const response = await request(backendBaseRoute)
      .post('/audioChannel/requestChannel')
      .send({ storyId: testStoryId, sampleRate: 16000 });
    testChannelId = response.body.channelId;
  });

  test('Upload chunk loadtest', async () => {
    const chunk = { data: testAudioData };

    const options = {
      url: `${backendBaseRoute}/audioChannel/upstream`,
      method: 'POST',
      body: {
        channelId: testChannelId,
        syncToDB: false,
        chunk,
      },
      contentType: 'application/json',
      maxSeconds,
      concurrency,
      maxRequests,
    };
    console.log('Upload chunk loadtest console output');
    try {
      const result = await loadTestPromise(options);
      console.log(result);
    } catch (err) {
      expect(true).toBe(false);
      console.log(err);
    }
  });

  afterAll(async () => {
    // delete test story
    const data = {
      query: `mutation {
        deleteStory(id: "${testStoryId}") {
          id
        }
      }`,
    };
    await request(backendBaseRoute).post('/admin/api').send(data);

    // delete test topic
    const data1 = {
      query: `mutation {
        deleteTopic(id: "${testTopicId}") {
          id
        }
      }`,
    };
    await request(backendBaseRoute).post('/admin/api').send(data1);

    // delete test user
    const data2 = {
      query: `mutation {
        deleteUser(id: "${testUserId}") {
          id
        }
      }`,
    };
    await request(backendBaseRoute).post('/admin/api').send(data2);
  });
});
