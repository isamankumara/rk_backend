import express from 'express';
export const router = express.Router();

import {
  getUserAuthedEndpoint,
  getUserPublishedThemesStoriesAuthedEndpoint,
  getUserSavedStoriesAuthedEndpoint,
  getUserLikedStoriesAuthedEndpoint,
  getUserBookmarkedStoriesAuthedEndpoint,
  getUserPublishedStoriesAuthedEndpoint,
  getUserDetailsFromUsernameAuthedEndpoint,
  bookmarkStoryAuthedEndpoint,
  unBookmarkStoryAuthedEndpoint,
  updateUserDetailsAuthedEndpoint,
  loginUserEndpoint,
  signupEndpoint,
  requestPasswordResetEndpoint,
  resetPasswordEndpoint,
} from './UserEndpoints';

import multer from 'multer'; // used to parse multi-part form data
const upload = multer({ dest: '/tmp/multer' });

// authed routes
router.get('/authed', getUserAuthedEndpoint);
router.get(
  '/authed/stories/published/bytheme',
  getUserPublishedThemesStoriesAuthedEndpoint
);
router.get('/authed/stories/saved', getUserSavedStoriesAuthedEndpoint);
router.get('/authed/stories/liked', getUserLikedStoriesAuthedEndpoint);
router.get(
  '/authed/stories/bookmarked',
  getUserBookmarkedStoriesAuthedEndpoint
);
router.get(
  '/authed/stories/bookmarked/:skip',
  getUserBookmarkedStoriesAuthedEndpoint
);
router.get(
  '/authed/stories/published',
  getUserPublishedStoriesAuthedEndpoint
);
router.get(
  '/authed/stories/publishked/:skip',
  getUserPublishedStoriesAuthedEndpoint
);
router.get(
  '/authed/userdetails/:username',
  getUserDetailsFromUsernameAuthedEndpoint
);
router.put('/authed/bookmark', bookmarkStoryAuthedEndpoint);
router.put('/authed/unbookmark', unBookmarkStoryAuthedEndpoint);
router.put(
  '/authed/update',
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'user', maxCount: 20 },
  ]),
  updateUserDetailsAuthedEndpoint
);

// unauthed routes
router.post('/login', loginUserEndpoint);
router.post(
  '/signup/:orgIdent',
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'user', maxCount: 20 },
  ]),
  signupEndpoint
);
router.post('/requestpasswordreset', requestPasswordResetEndpoint);
router.put('/resetpassword', resetPasswordEndpoint);

module.exports = router;
