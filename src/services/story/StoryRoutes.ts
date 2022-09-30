import express from 'express';
export const router = express.Router();

// Controller
import {
  getStoryTracksEndpoint,
  getStoryHlsEndpoint,
  createStoryStubAuthedEndpoint,
  restoreStoryAuthedEndpoint,
  getStoryByIdAuthedEndpoint,
  publishStoryAuthedEndpoint,
  saveStoryAuthedEndpoint,
  likeStoryAuthedEndpoint,
  unlikeStoryAuthedEndpoint,
  updateStoryDetailsAuthedEndpoint,
  deleteStoryAuthedEndpoint,
  getStoryByOrgAuthedEndpoint,
} from './StoryEndpoints';

// noauth routes
router.get('/:storyId/tracks', getStoryTracksEndpoint);
router.get('/:storyId/hls', getStoryHlsEndpoint);

// authed routes
router.post('/authed/stub', createStoryStubAuthedEndpoint);
router.get('/authed/restore/:storyId', restoreStoryAuthedEndpoint);
router.get('/authed/:storyId', getStoryByIdAuthedEndpoint);
router.put('/authed/publish/:storyId', publishStoryAuthedEndpoint);
router.put('/authed/save/:storyId', saveStoryAuthedEndpoint);
router.put('/authed/like', likeStoryAuthedEndpoint);
router.put('/authed/unlike', unlikeStoryAuthedEndpoint);
router.put('/authed/update/:storyId', updateStoryDetailsAuthedEndpoint);
router.delete('/authed/:storyId', deleteStoryAuthedEndpoint);
router.get('/authed', getStoryByOrgAuthedEndpoint);

module.exports = router;
