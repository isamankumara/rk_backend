import express from 'express';
import { getPlayableItemsAuthedEndpoint } from './PlayableItemEndpoints';
export const router = express.Router();

router.get('/authed/:tag', getPlayableItemsAuthedEndpoint);
module.exports = router;
