import { Response } from 'express';
import {
  AuthedRequest,
  UnAuthedRequest,
  UploadFileRef,
} from '../../ts/types/expressTypes';
import { MongoId } from '../../ts/types/contentTypes';
import {
  getUser,
  getUserPublishedThemesStories,
  getUserSavedStories,
  bookmarkStory,
  unBookmarkStory,
  updateUserDetails,
  getUserLikedStories,
  getUserBookmarkedStories,
  getUserPublishedStories,
  getUserDetailsFromUsername,
  loginUser,
  signupUser,
  requestPasswordReset,
  resetPassword,
} from './UserController';
import { getUserOrg } from '../../utils/UserUtil';
import { encryptID } from '../../utils/encryptToken';

export const getUserAuthedEndpoint = async function (
  req: AuthedRequest,
  res: Response
): Promise<void> {
  try {
    const userResult = await getUser(req.user.id);
    switch (userResult.status) {
      case 200:
        res.status(200).send(userResult.user);
        break;
      case 400:
        res.status(400).send(userResult.error);
        break;
    }
  } catch (error) {
    console.error('getUserAuthedEndpoint ', error);
    res.status(500).json({
      message: `An error has occurred: ${error}`,
    });
  }
};

export const getUserPublishedThemesStoriesAuthedEndpoint = async (
  req: AuthedRequest,
  res: Response
): Promise<void> => {
  try {
    const { identifier: orgIdent } = await getUserOrg(req.user.id);
    const themesStories = await getUserPublishedThemesStories(
      req.user.id,
      orgIdent
    );
    res.status(200).send(themesStories);
  } catch (error) {
    console.error('getUserPublishedThemesStoriesAuthedEndpoint ', error);
    res
      .status(500)
      .json(`getUserPublishedThemesStoriesAuthedEndpoint ${error}`);
  }
};

export const getUserSavedStoriesAuthedEndpoint = async (
  req: AuthedRequest,
  res: Response
): Promise<void> => {
  try {
    const savedStories = await getUserSavedStories(req.user.id);
    res.status(200).send(savedStories);
  } catch (error) {
    console.error('getUserSavedStoriesAuthedEndpoint ', error);
    res.status(500).json(`getUserSavedStoriesAuthedEndpoint ${error}`);
  }
};

export const getUserLikedStoriesAuthedEndpoint = async (
  req: AuthedRequest,
  res: Response
): Promise<void> => {
  try {
    const likedStories = await getUserLikedStories(req.user.id);
    res.status(200).send(likedStories);
  } catch (error) {
    console.error('getUserLikedStoriesAuthedEndpoint ', error);
    res.status(500).json(`getUserLikedStoriesAuthedEndpoint ${error}`);
  }
};

export const getUserBookmarkedStoriesAuthedEndpoint = async (
  req: AuthedRequest<{ params: { skip: string } }>,
  res: Response
): Promise<void> => {
  try {
    const { skip } = req.params;
    const bookmarkedStories = await getUserBookmarkedStories(req.user.id, skip);
    res.status(200).send(bookmarkedStories);
  } catch (error) {
    console.error('getUserBookmarkedStoriesAuthedEndpoint ', error);
    res.status(500).json(`getUserBookmarkedStoriesAuthedEndpoint ${error}`);
  }
};

export const getUserPublishedStoriesAuthedEndpoint = async (
  req: AuthedRequest<{ params: { skip: string } }>,
  res: Response
): Promise<void> => {
  try {
    const { skip } = req.params;
    const publishedStories = await getUserPublishedStories(req.user.id, skip);
    res.status(200).send(publishedStories);
  } catch (error) {
    console.error('getUserPublishedStoriesAuthedEndpoint ', error);
    res.status(500).json(`getUserPublishedStoriesAuthedEndpoint ${error}`);
  }
};
export const getUserDetailsFromUsernameAuthedEndpoint = async (
  req: AuthedRequest<{ params: { username: string } }>,
  res: Response
): Promise<void> => {
  try {
    const { username } = req.params;
    const userDetails = await getUserDetailsFromUsername(req.user.id, username);
    res.status(200).send(userDetails);
  } catch (error) {
    console.error('getUserDetailsFromUsernameAuthedEndpoint ', error);
    res.status(500).json(`getUserDetailsFromUsernameAuthedEndpoint ${error}`);
  }
};

export const bookmarkStoryAuthedEndpoint = async (
  req: AuthedRequest<{ body: { storyID: MongoId } }>,
  res: Response
): Promise<void> => {
  try {
    const { storyID } = req.body;
    await bookmarkStory(req.user.id, storyID);
    res.status(200).send();
  } catch (error) {
    console.error('bookmarkStoryAuthedEndpoint ', error);
    res.status(500).json(`bookmarkStoryAuthedEndpoint ${error}`);
  }
};

export const unBookmarkStoryAuthedEndpoint = async (
  req: AuthedRequest<{ body: { storyID: MongoId } }>,
  res: Response
): Promise<void> => {
  try {
    const { storyID } = req.body;
    await unBookmarkStory(req.user.id, storyID);
    res.status(200).send();
  } catch (error) {
    console.error('unBookmarkStoryAuthedEndpoint ', error);
    res.status(500).json(`unBookmarkStoryAuthedEndpoint ${error}`);
  }
};

export const updateUserDetailsAuthedEndpoint = async (
  req: AuthedRequest<{
    body: {
      user: string;
    };
    files: {
      avatar: UploadFileRef[];
    };
  }>,
  res: Response
): Promise<void> => {
  try {
    const { user: userDetailsJSON } = req.body;
    const avatar = req.files ? req.files.avatar : null;
    const result = await updateUserDetails(
      req.user.id,
      JSON.parse(userDetailsJSON),
      avatar ? avatar[0] : null
    );
    switch (result.status) {
      case 200:
        res.status(200).send(result.user);
        break;
      default:
        res.status(result.status).send(result.error);
        break;
    }
  } catch (error) {
    console.error('updateUserDetailsAuthedEndpoint ', error);
    res.status(500).json(`updateUserDetailsAuthedEndpoint ${error}`);
  }
};

export const loginUserEndpoint = async (
  req: UnAuthedRequest<{
    body: {
      emailAddress: string;
      password: string;
    };
  }>,
  res: Response
): Promise<void> => {
  try {
    const { emailAddress, password } = req.body;
    const result = await loginUser(emailAddress, password);
    switch (result.status) {
      case 200:
        const token: string = await encryptID(result.userDetails.id);
        res.set('Access-Control-Expose-Headers', 'authToken');
        res
          .status(200)
          .header('authToken', token)
          .send({ userData: result.userDetails });
        break;
      default:
        res.status(result.status).send(result.error);
        break;
    }
  } catch (error) {
    console.error('loginUserEndpoint ', error);
    res.status(500).send(`loginUserEndpoint ${error}`);
  }
};

export const signupEndpoint = async (
  req: UnAuthedRequest<{
    params: {
      orgIdent: string;
    };
    body: {
      user: string; // user details are sent in a JSON string
    };
    files: {
      avatar: UploadFileRef[];
    };
  }>,
  res: Response
): Promise<void> => {
  try {
    const { orgIdent } = req.params;
    if (!orgIdent) throw 'OrgIdent not specified in unauthed call';

    const { user: userJSON } = req.body;
    const avatar = req.files ? req.files.avatar : null; // note that avatar is an array -- by convention, only one image is being supplied

    const result = await signupUser(
      orgIdent,
      JSON.parse(userJSON),
      avatar ? avatar[0] : null
    );
    switch (result.status) {
      case 200:
        const token: string = await encryptID(result.newUser.id);
        res.status(200).header('authToken', token).send(result.newUser);
        break;
      default:
        res.status(result.status).send(result.error);
        break;
    }
  } catch (error) {
    console.error('signupUserEndpoint ', error);
    res.status(500).send(`signupUserEndpoint ${error}`);
  }
};

export const requestPasswordResetEndpoint = async (
  req: UnAuthedRequest<{
    body: {
      emailAddress: string;
    };
  }>,
  res: Response
): Promise<void> => {
  try {
    const { emailAddress } = req.body;
    const result = await requestPasswordReset(emailAddress);
    switch (result.status) {
      case 200:
        res.status(200).send();
        break;
      default:
        res.status(result.status).send(result.error);
        break;
    }
  } catch (error) {
    console.error('requestPasswordResetEndpoint ', error);
    res.status(500).send(`requestPasswordResetEndpoint ${error}`);
  }
};

export const resetPasswordEndpoint = async (
  req: UnAuthedRequest<{
    body: {
      userId: MongoId;
      password: string;
    };
  }>,
  res: Response
): Promise<void> => {
  try {
    const { userId, password } = req.body;
    const result = await resetPassword(userId, password);
    switch (result.status) {
      case 200:
        res.status(200).send();
        break;
    }
  } catch (error) {
    console.error('resetPasswordEndpoint ', error);
    res.status(500).send(`resetPasswordEndpoint ${error}`);
  }
};
