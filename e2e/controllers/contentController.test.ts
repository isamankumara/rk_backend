import request from 'supertest';
import { getContentFromSpreadsheet } from '../../src/services/content/helpers/ContentSyncHelper';
import { getItems } from '../../src/controllers/GQL';
import { prereqs, teardown, delay } from '../../jest/e2eUtil';
import { AUTO_TEST_ORG_IDENT } from '../../jest/data/testData';

describe('Content controller tests', () => {
  let app;
  beforeAll(async () => {
    jest.setTimeout(120000); // this must be the first command, otherwise jest will not honour promises...
    app = await prereqs(true, false);
  });

  test('Run content preflight', async () => {
    const response = await request(app).get(
      `/content/preflight/${AUTO_TEST_ORG_IDENT}`
    );
    expect(response.statusCode).toBe(200);
    await delay(10000);
  });

  test('Synchronise content on clean slate', async () => {
    const response = await request(app).put(
      `/content/synchronise/${AUTO_TEST_ORG_IDENT}`
    );
    expect(response.statusCode).toBe(200);

    // check object counts
    const [qSource, piSource, topicSource, themeSource] = await Promise.all([
      getContentFromSpreadsheet('Question'),
      getContentFromSpreadsheet('PlayableItem'),
      getContentFromSpreadsheet('Topic'),
      getContentFromSpreadsheet('Theme'),
    ]);

    const [qDB, piDB, topicDB, themeDB] = await Promise.all([
      getItems('Question', {}, 'id'),
      getItems('PlayableItem', {}, 'id'),
      getItems('Topic', {}, 'id'),
      getItems('Theme', {}, 'id'),
    ]);
    expect(qSource.length === qDB.length);
    expect(piSource.length === piDB.length);
    expect(topicSource.length === topicDB.length);
    expect(themeSource.length === themeDB.length);
    await delay(20000);
  });

  test('Synchronise content on top of pre-existing content', async () => {
    const response = await request(app).put(
      `/content/synchronise/${AUTO_TEST_ORG_IDENT}`
    );
    expect(response.statusCode).toBe(200);
    // check object counts
    const [qSource, piSource, topicSource, themeSource] = await Promise.all([
      getContentFromSpreadsheet('Question'),
      getContentFromSpreadsheet('PlayableItem'),
      getContentFromSpreadsheet('Topic'),
      getContentFromSpreadsheet('Theme'),
    ]);

    const [qDB, piDB, topicDB, themeDB] = await Promise.all([
      getItems('Question', {}, 'id'),
      getItems('PlayableItem', {}, 'id'),
      getItems('Topic', {}, 'id'),
      getItems('Theme', {}, 'id'),
    ]);
    expect(qSource.length).toBe(qDB.length);
    expect(piSource.length).toBe(piDB.length);
    expect(topicSource.length).toBe(topicDB.length);
    expect(themeSource.length).toBe(themeDB.length);
    await delay(20000);
  });

  test('Run content audit', async () => {
    const response = await request(app).put('/content/audit');
    expect(response.statusCode).toBe(200);
  });

  test('Cleardown org tags', async () => {
    const response = await request(app)
      .put(`/content/cleardown/${AUTO_TEST_ORG_IDENT}`)
      .send({ contentTypes: ['Tag'] });
    expect(response.statusCode).toBe(200);
    const tags = await getItems('Tag', {}, 'id');
    expect(tags.length).toBe(0);
  });

  test('Cleardown org playable items', async () => {
    const response = await request(app)
      .put(`/content/cleardown/${AUTO_TEST_ORG_IDENT}`)
      .send({ contentTypes: ['PlayableItem'] });
    expect(response.statusCode).toBe(200);
    const items = await getItems('PlayableItem', {}, 'id');
    expect(items.length).toBe(0);
  });

  test('Cleardown org questions', async () => {
    const response = await request(app)
      .put(`/content/cleardown/${AUTO_TEST_ORG_IDENT}`)
      .send({ contentTypes: ['Question'] });
    expect(response.statusCode).toBe(200);
    const items = await getItems('Question', {}, 'id');
    expect(items.length).toBe(0);
  });

  test('Cleardown org topics', async () => {
    const response = await request(app)
      .put(`/content/cleardown/${AUTO_TEST_ORG_IDENT}`)
      .send({ contentTypes: ['Topic'] });
    expect(response.statusCode).toBe(200);
    const items = await getItems('Topic', {}, 'id');
    expect(items.length).toBe(0);
  });

  test('Cleardown org themes', async () => {
    const response = await request(app)
      .put(`/content/cleardown/${AUTO_TEST_ORG_IDENT}`)
      .send({ contentTypes: ['Theme'] });
    expect(response.statusCode).toBe(200);
    const items = await getItems('Theme', {}, 'id');
    expect(items.length).toBe(0);
  });

  test('Cleardown org users', async () => {
    const response = await request(app)
      .put(`/content/cleardown/${AUTO_TEST_ORG_IDENT}`)
      .send({ contentTypes: ['User'] });
    expect(response.statusCode).toBe(200);
    const items = await getItems('User', {}, 'id');
    expect(items.length).toBe(0);
    await delay(20000);
  });

  test('Clearup cleardown org', async () => {
    const response1 = await request(app).put(
      `/content/synchronise/${AUTO_TEST_ORG_IDENT}`
    );
    expect(response1.statusCode).toBe(200);
    const response2 = await request(app).put(
      `/content/cleardown/${AUTO_TEST_ORG_IDENT}`
    ); // request default cleardown
    expect(response2.statusCode).toBe(200);
    const [qDB, piDB, topicDB, themeDB, tagDB] = await Promise.all([
      getItems('Question', {}, 'id'),
      getItems('PlayableItem', {}, 'id'),
      getItems('Topic', {}, 'id'),
      getItems('Theme', {}, 'id'),
      getItems('Tag', {}, 'id'),
    ]);
    expect(0).toBe(qDB.length);
    expect(0).toBe(piDB.length);
    expect(0).toBe(topicDB.length);
    expect(0).toBe(themeDB.length);
    expect(0).toBe(tagDB.length);
  });

  afterAll(async done => {
    await teardown(done, app, true);
  });
});
