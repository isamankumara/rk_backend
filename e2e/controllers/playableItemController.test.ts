import { ContentTypes } from '../../src/ts/types/contentTypes';
import {
  prereqs,
  signup,
  teardown,
  getPlayableItems,
} from '../../jest/e2eUtil';

describe('Playable Item controller tests', () => {
  let app, testUserAuthToken;
  beforeAll(async () => {
    jest.setTimeout(30000); // this must be the first command, otherwise jest will not honour promises...
    app = await prereqs(true, true, [
      ContentTypes.Tag,
      ContentTypes.PlayableItem,
    ]);
    testUserAuthToken = await signup(app);
  });

  test('Should get all playable items ', async () => {
    const response = await getPlayableItems(
      app,
      'featuredItems',
      testUserAuthToken
    );
    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(2); // as defined in all-content-sync-e2e-backend
    const response1 = await getPlayableItems(
      app,
      'preRecordingWalkThroughVideos',
      testUserAuthToken
    );
    expect(response1.statusCode).toBe(200);
    expect(response1.body.length).toBe(1); // as defined in all-content-sync-e2e-backend
  });

  afterAll(async done => {
    await teardown(done, app);
  });
});
