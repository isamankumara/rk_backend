require('dotenv/config');
import request from 'supertest';
import {
  prereqs,
  topicId,
  signup,
  teardown,
  saveStory,
  editStory,
  createStoryAndRetrieveMetadata,
  publishStory
} from '../../jest/e2eUtil';
import {
  rimrafPromise,
  mkDirPromise,
  readStreamToFile,
} from '../../src/utils/FileUtil';
import { s3GetObjectReadStream } from '../../src/utils/AWSUtil';
import { ContentTypes } from '../../src/ts/types/contentTypes';
import { testUserFields } from '../../jest/data/testData';

let testUserAuthToken;

describe('User controller tests', () => {
  let app;
  beforeAll(async () => {
    jest.setTimeout(900000); // this must be the first command, otherwise jest will not honour promises...
    await rimrafPromise('/tmp/userControllerTest');
    await mkDirPromise('/tmp/userControllerTest');
    const testImageReadStream = s3GetObjectReadStream(
      process.env.TEST_MEDIA_ASSET_SOURCE_BUCKET,
      'testImage.jpg',
      'none'
    );
    await readStreamToFile(
      testImageReadStream,
      '/tmp/userControllerTest/testImage.jpg'
    );
    app = await prereqs(true, true, [
      ContentTypes.User,
      ContentTypes.Theme,
      ContentTypes.Topic,
      ContentTypes.Question,
    ]);
    testUserAuthToken = await signup(app);
  });

  describe('User profile update', () => {
    test('Update user profile username should update username and preserve all other fields', async () => {
      testUserFields.username = 'jdoe3';
      const updatedUserData = JSON.stringify(testUserFields);

      const response = await request(app)
        .put('/user/authed/update')
        .set('Authorization', testUserAuthToken)
        .field('user', updatedUserData);

      expect(response.statusCode).toBe(200);
      expect(response.body.firstName).toBe(testUserFields.firstName);
      expect(response.body.lastName).toBe(testUserFields.lastName);
      expect(response.body.username).toBe(testUserFields.username);
      expect(response.body.emailAddress).toBe(testUserFields.emailAddress);
      expect(response.body.mobileNumber).toBe(testUserFields.mobileNumber);
    });
    test('Update user profile avatar should set avatar and preserve all other fields', async () => {
      const updatedUserData = JSON.stringify(testUserFields);

      const response = await request(app)
        .put('/user/authed/update')
        .set('Authorization', testUserAuthToken)
        .field('user', updatedUserData)
        .attach('avatar', '/tmp/userControllerTest/testImage.jpg');

      expect(response.statusCode).toBe(200);
      expect(response.body.firstName).toBe(testUserFields.firstName);
      expect(response.body.lastName).toBe(testUserFields.lastName);
      expect(response.body.username).toBe(testUserFields.username);
      expect(response.body.emailAddress).toBe(testUserFields.emailAddress);
      expect(response.body.mobileNumber).toBe(testUserFields.mobileNumber);
      expect(response.body.avatarImageMediaAsset).not.toBeFalsy();
    });
  });

  test('Get user details from username should return lastname and firstname mathing the username', async () => {
    const response = await request(app)
      .get('/user/authed/userdetails/e2euser')
      .set('Authorization', testUserAuthToken);

    expect(response.statusCode).toBe(200);
    expect(response.body.username).toBe('e2euser');
    expect(response.body.lastName).toBe('user');
    expect(response.body.firstName).toBe('e2e');
  });

  describe('Given user has saved two stories', () => {
    test('Should return saved stories in reverse chronological order', async () => {
      const testTopicId = await topicId();
      const {
        storyId: thisTestStoryId1,
        metadata: metadata1,
      } = await createStoryAndRetrieveMetadata(
        app,
        testTopicId,
        testUserAuthToken
      );
      await editStory(
        app,
        thisTestStoryId1,
        metadata1,
        ['e2eb/TEST/SHQ1', 'e2eb/TEST/SHQ2', 'e2eb/TEST/SHQ3'],
        testUserAuthToken,
        5
      );
      await saveStory(
        app,
        thisTestStoryId1,
        'Test save',
        metadata1,
        testUserAuthToken
      );

      const {
        storyId: thisTestStoryId2,
        metadata: metadata2,
      } = await createStoryAndRetrieveMetadata(
        app,
        testTopicId,
        testUserAuthToken
      );
      await editStory(
        app,
        thisTestStoryId2,
        metadata2,
        ['e2eb/TEST/SHQ1', 'e2eb/TEST/SHQ2', 'e2eb/TEST/SHQ3'],
        testUserAuthToken,
        5
      );
      await saveStory(
        app,
        thisTestStoryId2,
        'Test save',
        metadata2,
        testUserAuthToken
      );
      const response = await request(app)
        .get('/user/authed/stories/saved')
        .set('Authorization', testUserAuthToken);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('id', thisTestStoryId2);
      expect(response.body[1]).toHaveProperty('id', thisTestStoryId1);
    });
  });


  describe('Given user has published two stories', () => {
    test('Should return published stories in reverse chronological order', async () => {
      const testTopicId = await topicId();
      const {
        storyId: thisTestStoryId1,
        metadata: metadata1,
      } = await createStoryAndRetrieveMetadata(
        app,
        testTopicId,
        testUserAuthToken
      );
      await editStory(
        app,
        thisTestStoryId1,
        metadata1,
        ['e2eb/TEST/SHQ1', 'e2eb/TEST/SHQ2', 'e2eb/TEST/SHQ3'],
        testUserAuthToken,
        5
      );      
      const testStoryData1 = {
        title: 'Test story',
        metadata: metadata1,
        isPublic: true,
        selectedTags: [],
        storyTellers: [],
        duration: '0'
      };
      const response1 = await publishStory(
        app,
        thisTestStoryId1,
        testStoryData1,
        testUserAuthToken
      );
      expect(response1.statusCode).toBe(200);

      const {
        storyId: thisTestStoryId2,
        metadata: metadata2,
      } = await createStoryAndRetrieveMetadata(
        app,
        testTopicId,
        testUserAuthToken
      );
      await editStory(
        app,
        thisTestStoryId1,
        metadata2,
        ['e2eb/TEST/SHQ1', 'e2eb/TEST/SHQ2', 'e2eb/TEST/SHQ3'],
        testUserAuthToken,
        5
      );      
      const testStoryData2 = {
        title: 'Test story',
        metadata: metadata2,
        isPublic: true,
        selectedTags: [],
        storyTellers: [],
        duration: '0'
      };
      const response2 = await publishStory(
        app,
        thisTestStoryId2,
        testStoryData2,
        testUserAuthToken
      );
      expect(response2.statusCode).toBe(200);

      const response3 = await request(app)
        .get('/user/authed/stories/published')
        .set('Authorization', testUserAuthToken);

      expect(response3.statusCode).toBe(200);
      expect(response3.body).toHaveLength(2);
      expect(response3.body[0]).toHaveProperty('id', thisTestStoryId2);
      expect(response3.body[1]).toHaveProperty('id', thisTestStoryId1);
    });
  });



  afterAll(async done => {
    await teardown(done, app);
  });
});
