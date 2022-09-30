import { MongoId } from '../../ts/types/contentTypes';

import { getItems, executeGQL } from '../../controllers/GQL';
import { storyReturnFragment } from '../../fragments/storyFragment';

// Below is the main search function to return both users and stories.
export async function searchStories(
  orgIdent: string,
  tagId: MongoId = null,
  searchTerm = ''
) {
  const returnData = {
    stories: [],
  };

  // If the user clicks on tag search tags else free search off story title
  if (tagId) {
    const stories = await getItems(
      'Story',
      {
        tags_every: { id: tagId },
        isPublic: true,
        OR: [{ status: 'PUBLISHED' }, { status: 'PUBLISHED_FINALISED' }],
        interviewer: {
          organisation: {
            identifier: orgIdent,
          },
        },
      },
      storyReturnFragment
    );

    returnData.stories = stories;
  } else {
    const stories = await getItems(
      'Story',
      {
        title_contains: searchTerm,
        isPublic: true,
        OR: [{ status: 'PUBLISHED' }, { status: 'PUBLISHED_FINALISED' }],
        interviewer: {
          organisation: {
            identifier: orgIdent,
          },
        },
      },
      storyReturnFragment
    );

    returnData.stories = stories;
  }

  return returnData;
};

export async function searchUsernames(orgIdent: string, searchTerm = '') {
  const { allUsers } = await executeGQL(
    `query {
      allUsers (
        sortBy: username_ASC, 
        where: {
          username_starts_with: "${searchTerm}",
          organisation: {
            identifier: "${orgIdent}"
          },
        }
      )
      {
        id
        firstName
        lastName
        username
        avatarImageMediaAsset {
          url
        }
      }
    }`
  );
  return allUsers;
}

// GET all stories questions
export async function getAllPublicStories(orgIdent: string, skip = '0') {
  const { allStories } = await executeGQL(
    `query {
      allStories (
        sortBy: id_DESC, 
        first: 5, 
        skip: ${skip}, 
        where: {
          isPublic: true, 
          OR: [
            { status: PUBLISHED },
            { status: PUBLISHED_FINALISED },
          ],
          interviewer: {
            organisation: {
              identifier: "${orgIdent}"
            },
          }
        }
      )
      {
        ${storyReturnFragment}
      }
    }`
  );

  return allStories;
};