 import { ContentTypes, PlaylistStatus } from '../../src/ts/types/contentTypes';
 import request from 'supertest';
 import { prereqs, signup, teardown,
  topicId,
  tagId, } from '../../jest/e2eUtil';

  let testUserAuthToken;
  let playlistOwnerToken;
  let e2eTestSecondUserId;
  let e2eTestUserId,
  testPlaylistId,
  testTagId;

describe('Playlist controller tests', () => {
  let app

  beforeAll(async () => {
    jest.setTimeout(180000); // this must be the first command, otherwise jest will not honour promises...
    app = await prereqs(true, true, [
      ContentTypes.Story,
      ContentTypes.User,
    ]);
    testUserAuthToken = await signup(app);
    playlistOwnerToken = await signup(app, {
      firstName: 'John2',
      lastName: 'Doe2',
      emailAddress: 'john2@doe.com',
      username: 'jdoe2',
      mobileNumber: '12345679',
      password: '12345679',
    })
    // set e2eTestUserId
    const data = {
        query: `query User($emailAddress: String!){
          allUsers(where: 
            {
              emailAddress: $emailAddress
            }
          )
          {
            id
          }
        }`,
        variables: {
          emailAddress: 'e2e@user.com', // as defined in all-content-sync-e2e-backend
        },
      };

    const response = await request(app).post('/admin/api').send(data);
    const allUserIdsE2e = response.body.data.allUsers;
    e2eTestUserId = allUserIdsE2e[0].id;


    data.variables.emailAddress = "e2e_api_user2@alifelived.com";
    const secondUserResponse = await request(app).post('/admin/api').send(data);
    const allUserIds = response.body.data.allUsers;
    e2eTestSecondUserId = allUserIds[0].id;
  });

  

  describe('Playlist workflow', () => {
    test('Should create a playlist', async () => {
      const response = await request(app)
        .post(`/playlist/authed/create`)
        .set('Authorization', testUserAuthToken)
        .send({
          "title": "test1",
          "users":[e2eTestUserId],
          "isPublic": true,
          "playlistStatus": PlaylistStatus.PUBLISHED
      });
      testPlaylistId = response.body.id;
      expect(response.statusCode).toBe(200)
    });

    test('Should create playlist with different user' ,async () => {
      const response = await request(app)
        .post(`/playlist/authed/create`)
        .set('Authorization', playlistOwnerToken)
        .send({
          "title": "test2",
          "isPublic": true,
          "playlistStatus": PlaylistStatus.PUBLISHED
      });
      const newPlaylistId = response.body.id;
      expect(response.statusCode).toBe(200);
    })

    test('Should get all playlists', async () => {
      const response = await request(app)
        .get(`/playlist/authed`)
        .set('Authorization', testUserAuthToken)

      expect(response.statusCode).toBe(200);
      expect (response.body.length).toBe(1);
    });

    test('Should update a playlist', async () => {
      const response = await request(app)
        .put(`/playlist/authed/update/` + testPlaylistId)
        .set('Authorization', testUserAuthToken)
        .send({"playlistDetails":{
          "title": "test3",
          "users":[e2eTestUserId],
          "isPublic": true,
          "playlistStatus": PlaylistStatus.PUBLISHED
      }});
      expect(response.statusCode).toBe(200);
      expect (response.body.title).toBe("test3");
    });

    test('Should one playlist by id', async () => {
      const response = await request(app)
        .get(`/playlist/authed/` + testPlaylistId)
        .set('Authorization', testUserAuthToken)
      expect(response.statusCode).toBe(200);
      expect (response.body.title).toBe("test3");
    });


    test('Should delete a playlist', async () => {
      const response = await request(app)
        .delete(`/playlist/authed/` + testPlaylistId)
        .set('Authorization', testUserAuthToken)

        expect(response.statusCode).toBe(200);
        expect(response.body.id).toBe(testPlaylistId);
    })
  });

  afterAll(async done => {
    await teardown(done, app);
  });
});
