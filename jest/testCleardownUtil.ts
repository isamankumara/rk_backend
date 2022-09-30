import request from 'supertest';
import { MongoId } from '../src/ts/types/contentTypes';
const getStoryAudioChannels = async (
  storyId: MongoId,
  backendBaseRoute: string
) => {
  const data = {
    query: `query AudioChannel($testStoryId: ID!){
          allAudioChannels(where: 
            {
              story: {
                id: $testStoryId
              }
            }
          )
          {
            id
          }
        }`,
    variables: {
      testStoryId: storyId,
    },
  };
  const response = await request(backendBaseRoute)
    .post('/admin/api')
    .send(data);
  return response.body.data.allAudioChannels.map(obj => obj.id);
};

export const deleteTestedAudioChannels = async (
  testStoryIds: MongoId[],
  backendBaseRoute: string
) => {
  if (!testStoryIds || testStoryIds.length === 0) return;
  const testStoryAudioChannelsGroups: MongoId[][] = await Promise.all(
    testStoryIds.map(storyId =>
      getStoryAudioChannels(storyId, backendBaseRoute)
    )
  );

  const flatAudioChannels: MongoId[] = testStoryAudioChannelsGroups.reduce(
    (flatChannels, audioChannelGroup) => {
      flatChannels.push(...audioChannelGroup);
      return flatChannels;
    },
    []
  );
  const data = {
    query: `mutation DeleteAudioChannels($audioChannelIds: [ID!]){
            deleteAudioChannels( 
              ids: $audioChannelIds ) {
              id
            }
          }`,
    variables: {
      audioChannelIds: flatAudioChannels,
    },
  };
  await request(backendBaseRoute).post('/admin/api').send(data);
};

export const deleteTestUsers = async (
  testUserEmail: string,
  backendBaseRoute: string
) => {
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
      emailAddress: testUserEmail,
    },
  };

  const response = await request(backendBaseRoute)
    .post('/admin/api')
    .send(data);
  const allUserIds = response.body.data.allUsers;

  const data1 = {
    query: `mutation DeleteUsers($userIds: [ID!]){
        deleteUsers( 
          ids: $userIds ) {
          id
        }
      }`,
    variables: {
      userIds: allUserIds.map(idObj => idObj.id),
    },
  };

  await request(backendBaseRoute).post('/admin/api').send(data1);
};

export const deleteTestThemes = async (
  testThemeTitle: string,
  backendBaseRoute: string
) => {
  const data = {
    query: `query Theme($testThemeTitle: String!){
        allThemes(where: 
          {
            title: $testThemeTitle
          }
        )
        {
          id
        }
      }`,
    variables: {
      testThemeTitle,
    },
  };

  const response = await request(backendBaseRoute)
    .post('/admin/api')
    .send(data);
  const allThemeIds = response.body.data.allThemes;

  const data1 = {
    query: `mutation DeleteThemes($themeIds: [ID!]){
        deleteThemes( 
          ids: $themeIds ) {
          id
        }
      }`,
    variables: {
      themeIds: allThemeIds.map(idObj => idObj.id),
    },
  };
  await request(backendBaseRoute).post('/admin/api').send(data1);
};

export const deleteTestTopics = async (
  testTopicTitle: string,
  backendBaseRoute: string
) => {
  const data = {
    query: `query Topic($testTopicTitle: String!){
          allTopics(where: 
            {
              title: $testTopicTitle
            }
          )
          {
            id
          }
        }`,
    variables: {
      testTopicTitle,
    },
  };

  const response = await request(backendBaseRoute)
    .post('/admin/api')
    .send(data);
  const allTopicIds = response.body.data.allTopics;
  const data1 = {
    query: `mutation DeleteTopics($topicIds: [ID!]){
          deleteTopics( 
            ids: $topicIds ) {
            id
          }
        }`,
    variables: {
      topicIds: allTopicIds.map(idObj => idObj.id),
    },
  };
  await request(backendBaseRoute).post('/admin/api').send(data1);
};
export const deleteTestStories = async (
  testStoryTitle: string,
  backendBaseRoute: string
) => {
  const data = {
    query: `query Story($testStoryTitle: String!){
            allStories(where: 
              {
                title: $testStoryTitle
              }
            )
            {
              id
            }
          }`,
    variables: {
      testStoryTitle,
    },
  };

  const response = await request(backendBaseRoute)
    .post('/admin/api')
    .send(data);
  const allStoryIds = response.body.data.allStories;

  const data1 = {
    query: `mutation DeleteStories($storyIds: [ID!]){
            deleteStories( 
              ids: $storyIds ) {
              id
            }
          }`,
    variables: {
      storyIds: allStoryIds.map(idObj => idObj.id),
    },
  };
  await request(backendBaseRoute).post('/admin/api').send(data1);
};
