import { ContentTypes } from '../../src/ts/types/contentTypes';
import request from 'supertest';
import { prereqs, signup, teardown } from '../../jest/e2eUtil';

describe('Theme controller tests', () => {
  let app, testUserAuthToken;
  beforeAll(async () => {
    jest.setTimeout(30000); // this must be the first command, otherwise jest will not honour promises...
    app = await prereqs(true, true, [ContentTypes.Theme, ContentTypes.Topic]);
    testUserAuthToken = await signup(app);
  });

  test('Should get all themes sorted by title, with nested topics sorted by sequence ', async () => {
    const response = await request(app)
      .get('/theme/authed')
      .set('Authorization', testUserAuthToken);
    expect(response.statusCode).toBe(200);
    const themes = response.body;
    expect(themes.length).toBe(2); // as defined on Theme tab of all-content-sync-e2e-tests
    expect(themes[0].identifier).toBe('e2eb/TEST_THEME'); // should come first due to title alpha sorting
    expect(themes[1].identifier).toBe('e2eb/LIFE_STORY');
    const lifeStoryTopics = themes[1].topics;
    expect(lifeStoryTopics.length).toBe(3);
    expect(lifeStoryTopics[0].identifier).toBe('e2eb/SHORT_STORY2');
    expect(lifeStoryTopics[1].identifier).toBe('e2eb/TEST');
    expect(lifeStoryTopics[2].identifier).toBe('e2eb/SHORT_STORY');
  });

  afterAll(async done => {
    await teardown(done, app);
  });
});
