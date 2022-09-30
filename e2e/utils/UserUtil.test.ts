import request from 'supertest';
import { getUserOrg } from '../../src/utils/UserUtil';
import { prereqs, teardown } from '../../jest/e2eUtil';
import { ContentTypes } from '../../src/ts/types/contentTypes';

describe('User util tests', () => {
  let app;

  beforeAll(async () => {
    try {
      jest.setTimeout(1800000); // this must be the first command, otherwise jest will not honour promises...
      app = await prereqs(true, true, [ContentTypes.User]);
    } catch (err) {
      console.error(err);
    }
  });

  test('Get user org ident', async () => {
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
    const allUserIds = response.body.data.allUsers;
    const userId = allUserIds[0].id;
    const userOrg = await getUserOrg(userId);
    expect(userOrg.identifier).toBe('E2E_BACKEND');
  });

  afterAll(async done => {
    await teardown(done, app, true, 10000); // throttle to avoid 'import after teardown' console error
  });
});
