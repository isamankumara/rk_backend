import express from 'express';
export const router = express.Router();

import { getTopicPlaybackMetadataAuthedEndpoint } from './TopicEndpoints';

// authed routes
router.get('/authed/playback/:topicId', getTopicPlaybackMetadataAuthedEndpoint);
module.exports = router;
