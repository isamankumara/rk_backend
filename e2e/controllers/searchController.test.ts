import { ContentTypes } from '../../src/ts/types/contentTypes';
import request from 'supertest';
import {
  prereqs,
  signup,
  topicId,
  createStoryAndRetrieveMetadata,
  editStory,
  publishStory,
  teardown,
} from '../../jest/e2eUtil';

describe('Story controller tests', () => {
  let app, testUserAuthToken, testTopicId;
  beforeAll(async () => {
    try {
      jest.setTimeout(180000); // this must be the first command, otherwise jest will not honour promises...
      app = await prereqs(true, true, [
        ContentTypes.Theme,
        ContentTypes.Topic,
        ContentTypes.Question,
        ContentTypes.User,
      ]);
      testUserAuthToken = await signup(app);
      testTopicId = await topicId();
    } catch (err) {
      console.log(err);
    }
  });

  describe('Search tests', () => {
    test('Get all public stories', async () => {
      const response = await request(app)
        .get(`/search/authed/allpublicstories/${0}`)
        .set('Authorization', testUserAuthToken);
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBe(0);

      const { storyId, metadata } = await createStoryAndRetrieveMetadata(
        app,
        testTopicId,
        testUserAuthToken
      );
      await editStory(
        app,
        storyId,
        metadata,
        ['e2eb/TEST/SHQ1'],
        testUserAuthToken,
        1
      );
      await publishStory(
        app,
        storyId,
        {
          title: 'Test story',
          metadata,
          isPublic: true,
          selectedTags: [],
          storyTellers: [],
          duration: '10',
        },
        testUserAuthToken
      );

      const response1 = await request(app)
        .get(`/search/authed/allpublicstories/${0}`)
        .set('Authorization', testUserAuthToken);
      expect(response1.statusCode).toBe(200);
      expect(response1.body.length).toBe(1);
    });
    test('Search usernames', async () => {
      const response = await request(app)
        .get(
          `/search/authed/searchusernames/e2e` // hint 'e2e' for 'e2euser' as defined in all-content-sync-backend
        )
        .set('Authorization', testUserAuthToken);
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBe(2);

      const response1 = await request(app)
        .get(`/search/authed/searchusernames/fred`)
        .set('Authorization', testUserAuthToken); // e2euser as defined in all-content-sync-backend
      expect(response1.statusCode).toBe(200);
      expect(response1.body.length).toBe(0);
    });

    afterAll(async done => {
      await teardown(done, app);
    });
  });
});
