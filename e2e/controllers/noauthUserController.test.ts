require('dotenv/config');
import request from 'supertest';
import { s3GetObjectReadStream } from '../../src/utils/AWSUtil';
import {
  rimrafPromise,
  mkDirPromise,
  readStreamToFile,
} from '../../src/utils/FileUtil';
import { prereqs, teardown } from '../../jest/e2eUtil';
import { AUTO_TEST_ORG_IDENT, testUserFields } from '../../jest/data/testData';

const testUserFields1 = {
  firstName: 'John',
  lastName: 'Doe',
  emailAddress: 'john2@doe.com',
  username: 'jdoe2',
  mobileNumber: '12345678',
  password: '12345678',
};

const testUserFields2 = {
  firstName: 'John',
  lastName: 'Doe',
  emailAddress: 'john3@doe.com',
  username: 'jdoe3',
  mobileNumber: '12345678',
  password: '12345678',
};

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
    app = await prereqs(true, false);
  });

  describe('User signup and password reset', () => {
    test('Sign up test user without avatar image', async () => {
      const userData = JSON.stringify(testUserFields);

      const response = await request(app)
        .post(`/user/signup/${AUTO_TEST_ORG_IDENT}`)
        .field('user', userData);
      expect(response.statusCode).toBe(200);
      expect(response.body.firstName).toBe(testUserFields.firstName);
      expect(response.body.lastName).toBe(testUserFields.lastName);
      expect(response.body.username).toBe(testUserFields.username);
      expect(response.body.emailAddress).toBe(testUserFields.emailAddress);
      expect(response.body.mobileNumber).toBe(testUserFields.mobileNumber);
    });

    test('Sign up test user with avatar image', async () => {
      const userData = JSON.stringify(testUserFields1);

      const response = await request(app)
        .post(`/user/signup/${AUTO_TEST_ORG_IDENT}`)
        .field('user', userData)
        .attach('avatar', '/tmp/userControllerTest/testImage.jpg');

      expect(response.statusCode).toBe(200);
      expect(response.body.firstName).toBe(testUserFields1.firstName);
      expect(response.body.lastName).toBe(testUserFields1.lastName);
      expect(response.body.username).toBe(testUserFields1.username);
      expect(response.body.emailAddress).toBe(testUserFields1.emailAddress);
      expect(response.body.mobileNumber).toBe(testUserFields1.mobileNumber);
      expect(response.body.avatarImageMediaAsset).not.toBeFalsy();
    });
    test('Should test reset password function', async () => {
      const userData = JSON.stringify(testUserFields2);

      const response = await request(app)
        .post(`/user/signup/${AUTO_TEST_ORG_IDENT}`)
        .field('user', userData);

      const testUserId = response.body.id;
      const response1 = await request(app)
        .put('/user/resetpassword')
        .send({ userId: testUserId, password: 'testPassword' });

      expect(response1.statusCode).toBe(200);
    });

    test('Should NOT reset password without id function', async () => {
      const response = await request(app)
        .put('/user/resetpassword')
        .send({ userId: null, password: 'testPassword' });

      expect(response.statusCode).toBe(500);
    });
  });

  afterAll(async done => {
    await teardown(done, app);
  });
});
