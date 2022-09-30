import { ContentTypes } from '../../src/ts/types/contentTypes';
import request from 'supertest';
import { prereqs, signup, teardown } from '../../jest/e2eUtil';

describe('Tag controller tests', () => {
  let app, testUserAuthToken;
  beforeAll(async () => {
    jest.setTimeout(70000); // this must be the first command, otherwise jest will not honour promises...
    app = await prereqs(true, true, [ContentTypes.Tag]);
    testUserAuthToken = await signup(app);
  });

  test('Should get all tags ', async () => {
    const response = await await request(app)
      .get(`/tag/authed`)
      .set('Authorization', testUserAuthToken);

    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(34); // as defined in all-content-sync-unit-tests
  });

  afterAll(async done => {
    await teardown(done, app);
  });
});
