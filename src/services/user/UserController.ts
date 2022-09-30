import {
  getItems,
  getItem,
  updateItem,
  createItem,
  executeGQLWithAuthedItem,
  executeGQL,
} from '../../controllers/GQL';
import { validateUser } from '../../utils/AuthUtil';
import { registerAndUploadAvatarToS3, getUserOrg } from '../../utils/UserUtil';
import { connectOrganisation } from '../../services/content/helpers/ContentSyncHelper';
import { sendTemplateEmailPromise } from '../../controllers/emailApi';

// Fragments
import { storyReturnFragment } from '../../fragments/storyFragment';
import { userReturnFragment } from '../../fragments/userFragment';

import { reduceThemesStories } from './helpers/ThemesStoriesHelper';

// ts
import {
  MongoId,
  User,
  Story,
  ThemeStoriesContainer,
  UserSignupFields,
  StoryStatus,
} from '../../ts/types/contentTypes';
import { UploadFileRef } from '../../ts/types/expressTypes';

const BENCHMARK_BANDWIDTH = process.env.BANDWIDTH_BENCHMARK
  ? process.env.BANDWIDTH_BENCHMARK
  : '10000';

// Find individual user
export async function getUser(
  userId: MongoId
): Promise<{ status: number; error?: string; user?: User }> {
  // find user and return selected fields
  const user: User = await getItem(
    'User',
    userId,
    `id
      firstName
      lastName
      username
      emailAddress
      mobileNumber
      avatarImageMediaAsset {
        url
      }
      bookmarks {
        id
      }
      likedStories {
        id
      }
`
  );

  if (!user) {
    return { status: 400, error: "User Doesn't exist" };
  }

  // add the bandwidth benchmark used by client to measure network quality
  user.bandwidthBenchmark = BENCHMARK_BANDWIDTH;
  return { status: 200, user };
}

export async function updateUserDetails(
  userId: MongoId,
  userDetails: {
    firstName: string;
    lastName: string;
    username: string;
    emailAddress: string;
    password: string;
    mobileNumber: string;
    avatarImageMediaAsset?: { connect: { id: MongoId } };
  },
  avatarImage: { originalname: string; path: string; mimetype: string }
): Promise<{ status: number; user?: User; error?: string }> {
  // get reference to avatar if supplied
  let avatarImageMediaAssetId;

  if (avatarImage)
    avatarImageMediaAssetId = await registerAndUploadAvatarToS3(avatarImage);

  // Checks if emailAddress already exists
  const emailAddressExist = await getItems(
    'User',
    { emailAddress: userDetails.emailAddress },
    'id'
  );

  // Checks if username already exits
  const usernameExist = await getItems(
    'User',
    { username: userDetails.username },
    'username'
  );

  // Gets the current user and checks if the email/username is unchanged
  const currentUser: User = await getItem(
    'User',
    userId,
    `username, emailAddress, id`
  );

  // Check if email or usernames exist but also check they don't match the current details
  if (emailAddressExist.length > 0 && emailAddressExist[0].id !== userId) {
    return { status: 400, error: 'Email already exists' };
  } else if (
    usernameExist.length > 0 &&
    usernameExist[0].username != currentUser.username
  ) {
    return { status: 400, error: 'Username already exists' };
  } else if (
    usernameExist.length > 0 &&
    emailAddressExist.length > 0 &&
    emailAddressExist[0].id != userId &&
    usernameExist[0].username != currentUser.username
  ) {
    return { status: 400, error: 'Username and email already exists' };
  }

  // Need to wrap the media asset ref in a connect for keystone
  if (avatarImageMediaAssetId) {
    userDetails.avatarImageMediaAsset = {
      connect: {
        id: avatarImageMediaAssetId,
      },
    };
  }

  // Save object
  const savedUser: User = await updateItem(
    'User',
    userId,
    userDetails,
    userReturnFragment
  );
  return { status: 200, user: savedUser };
}

export async function bookmarkStory(
  userId: MongoId,
  storyId: MongoId
): Promise<void> {
  await updateItem('User', userId, {
    bookmarks: {
      connect: {
        id: storyId,
      },
    },
  });
}

export async function unBookmarkStory(
  userId: MongoId,
  storyId: MongoId
): Promise<void> {
  await updateItem('User', userId, {
    bookmarks: {
      disconnect: {
        id: storyId,
      },
    },
  });
}

export async function getUserSavedStories(userId: MongoId): Promise<Story[]> {
  const { allStories: savedUserStories } = await executeGQL(
    `query {
      allStories (
        sortBy: id_DESC, 
        where: {
          status: SAVED,
          interviewer: {
            id: "${userId}"
          }
        }
      )
      {
        ${storyReturnFragment}
      }
    }`
  );

  return savedUserStories;
}

export async function getUserPublishedThemesStories(
  userId: MongoId,
  userOrgIdent: string
): Promise<ThemeStoriesContainer[]> {
  let themesResult = await executeGQLWithAuthedItem(
    `
      query {
        allThemes(
          sortBy: title_ASC,
          where: {
            organisation: {
              identifier: "${userOrgIdent}"
            } 
          })
        {
          id
          title
          topics {
            id
            title
            themes
            stories(
              sortBy: id_DESC, 
              where: {
                OR: [
                  { status: PUBLISHED },
                  { status: PUBLISHED_FINALISED },
                ],
                interviewer: {
                  id: "${userId}"
                }
              }
            ) {
              ${storyReturnFragment}
            }
          }
        }
      }`,
    userId,
    'Story'
  );
  const themesStories: ThemeStoriesContainer[] = reduceThemesStories(
    themesResult.allThemes
  );
  themesResult = null; // CU-1t20ke4 prevent memleak
  return themesStories;
}

export const getUserLikedStories = async (
  userId: MongoId
): Promise<Story[]> => {
  const { likedStories } = await getItem(
    'User',
    userId,
    `likedStories { ${storyReturnFragment}}`
  );

  return likedStories;
};

export const getUserBookmarkedStories = async (
  userId: MongoId,
  skip = '0'
): Promise<Story[]> => {
  const { bookmarks: bookmarkedStories } = await getItem(
    'User',
    userId,
    `bookmarks (
      sortBy: id_DESC, 
      first: 5, 
      skip: ${skip},
    )
    { ${storyReturnFragment}}`
  );
  return bookmarkedStories;
};

export const getUserPublishedStories = async (
  userId: MongoId,
  skip = '0'
): Promise<Story[]> => {
  const { allStories: publishedStories } = await executeGQL(
    `query {
      allStories (
        sortBy: id_DESC, 
        first: 5, 
        skip: ${skip}, 
        where: {
          OR: [
            { status: PUBLISHED },
            { status: PUBLISHED_FINALISED },
          ],
          interviewer: {
            id: "${userId}",
          }
        }
      )
      {
        ${storyReturnFragment}
      }
    }`
  );

  return publishedStories;

};

export const getUserDetailsFromUsername = async (
  userId: MongoId,
  username: string
): Promise<User> => {
  const { identifier: orgIdent } = await getUserOrg(userId);
  const users = await getItems(
    'User',
    {
      username,
      organisation: {
        identifier: orgIdent,
      },
    },
    `id
      username
      firstName
      lastName
      avatarImageMediaAsset {
        url
      }
      `
  );

  return users[0];
};

export async function loginUser(
  emailAddress: string,
  password: string
): Promise<{ status: number; userDetails?: User; error?: string }> {
  // Checking if user exists
  const result = await validateUser(emailAddress, password);

  if (!result.success) {
    return {
      status: 401,
      error: 'Invalid email and password combination received.',
    };
  }

  const users: User[] = await getItems(
    'User',
    {
      emailAddress,
    },
    `id
      organisation {
        identifier
        logoURL
      }
      firstName
      lastName
      username
      emailAddress
      mobileNumber
      avatarImageMediaAsset {
        url
      }
      bookmarks {
        id
      }
      likedStories {
        id
      }
      `
  );

  if (users.length === 0) {
    // in fact, user has tried to log in with valid credentials but for a different org than the one specified
    return {
      status: 401,
      error: 'Invalid email and password combination received.',
    };
  }

  const userDetails: User = users[0];
  userDetails.bandwidthBenchmark = BENCHMARK_BANDWIDTH;
  return {
    status: 200,
    userDetails,
  };
}

export async function signupUser(
  orgIdent: string,
  userFields: UserSignupFields,
  avatarFileRef: UploadFileRef
): Promise<{ status: number; newUser?: User; error?: string }> {
  const avatarImageMediaAssetId: MongoId = avatarFileRef
    ? await registerAndUploadAvatarToS3(avatarFileRef)
    : null;

  // connect to organisation
  userFields.organisation = orgIdent;
  await connectOrganisation(userFields);

  // Checks if emailAddress already exists
  const usersMatchingByEmail: User[] = await getItems(
    'User',
    {
      emailAddress: userFields.emailAddress,
    },
    'id'
  );
  // Checks if username already exits
  const usersMatchingByUsername: User[] = await getItems(
    'User',
    {
      username: userFields.username,
    },
    'username'
  );

  if (usersMatchingByEmail.length > 0) {
    return { status: 400, error: 'Email already exists' };
  } else if (usersMatchingByUsername.length > 0) {
    return { status: 400, error: 'Username already exists' };
  } else if (
    usersMatchingByEmail.length > 0 &&
    usersMatchingByUsername.length > 0
  ) {
    return { status: 400, error: 'Username and email already exists' };
  }

  // Need to wrap the media asset ref in a connect for keystone
  if (avatarImageMediaAssetId) {
    userFields.avatarImageMediaAsset = {
      connect: {
        id: avatarImageMediaAssetId,
      },
    };
  }

  const savedUser: User = await createItem(
    'User',
    userFields,
    userReturnFragment
  );

  savedUser.bandwidthBenchmark = BENCHMARK_BANDWIDTH;
  return {
    status: 200,
    newUser: savedUser,
  };
}

export const requestPasswordReset = async (
  emailAddress: string
): Promise<{ status: number; error?: string }> => {
  const users: User[] = await getItems('User', { emailAddress }, `id`);

  if (users.length === 0) {
    return { status: 401, error: 'No user associated with email address' };
  }

  const user = users[0];

  await sendTemplateEmailPromise(
    {
      to: `"${emailAddress}" <${emailAddress}>`,
    },
    'A Life Lived password reset', // Subject line
    'request-password-reset', // template
    {
      resetLink: `alifelived://reset-password/${user.id}`,
    }
  );
  return {
    status: 200,
  };
};

export const resetPassword = async (
  userId: MongoId,
  password: string
): Promise<{ status: number }> => {
  await updateItem('User', userId, { password }, `id`);
  return { status: 200 };
};
