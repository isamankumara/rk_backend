import { ContentTypes } from '../../src/ts/types/contentTypes';
import {
  prereqs,
  signup,
  teardown,
  topicPlaybackMetadata,
  topicId,
} from '../../jest/e2eUtil';

let testUserAuthToken;

describe('Topic controller tests', () => {
  let app;
  beforeAll(async () => {
    jest.setTimeout(30000); // this must be the first command, otherwise jest will not honour promises...
    app = await prereqs(true, true, [
      ContentTypes.Theme,
      ContentTypes.Topic,
      ContentTypes.Question,
    ]);
    testUserAuthToken = await signup(app);
  });

  test('Topic playback metadata', async () => {
    const testTopicId = await topicId(); // TEST_TOPIC
    const response = await topicPlaybackMetadata(
      app,
      testTopicId,
      testUserAuthToken
    );
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(10); // as per TEST_TOPIC definition in all-content-sync-e2e-tests
  });

  afterAll(async done => {
    await teardown(done, app);
  });
});
