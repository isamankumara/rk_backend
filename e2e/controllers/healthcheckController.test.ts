import request from 'supertest';
import { prereqs, teardown } from '../../jest/e2eUtil';

describe('Health check controller tests', () => {
  let app;
  beforeAll(async () => {
    jest.setTimeout(30000); // this must be the first command, otherwise jest will not honour promises...
    app = await prereqs(true, false);
  });

  test('Test health check', async () => {
    const response = await request(app).get('/healthcheck');
    expect(response.statusCode).toBe(200);
  });

  afterAll(async done => {
    await teardown(done, app);
  });
});
