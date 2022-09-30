import { ContentTypes } from '../../src/ts/types/contentTypes';
import { redisGetStoryTracks } from '../../src/utils/RedisUtil';
import {
  prereqs,
  signup,
  topicId,
  createStoryAndRetrieveMetadata,
  editStory,
  publishStory,
  getStoryTracks,
  teardown,
} from '../../jest/e2eUtil';

let testUserAuthToken, testTopicId;

describe('Noauth story  controller tests', () => {
  let app;
  beforeAll(async () => {
    try {
      ContentTypes;
      jest.setTimeout(180000); // this must be the first command, otherwise jest will not honour promises...
      app = await prereqs(true, true, [
        ContentTypes.Tag,
        ContentTypes.Theme,
        ContentTypes.Topic,
        ContentTypes.Question,
      ]);
      testUserAuthToken = await signup(app);
      testTopicId = await topicId();
    } catch (err) {
      console.log(err);
    }
  });

  test('get story tracks from published story', async () => {
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
    const tracksResponse = await getStoryTracks(app, storyId);

    expect(tracksResponse.statusCode).toBe(200);

    const tracks = tracksResponse.body;
    expect(tracks.length).toBe(1);
    // check redis cacheing
    const cachedTracks = await redisGetStoryTracks(storyId);
    expect(cachedTracks.length).toBe(1);
  });

  afterAll(async done => {
    await teardown(done, app);
  });
});
