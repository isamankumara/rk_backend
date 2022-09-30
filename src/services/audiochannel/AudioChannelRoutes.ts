import express from 'express';
export const router = express.Router();

import {
  requestChannelAuthedEndpoint,
  upstreamHLSAuthedEndpoint,
  clearChannelAuthedEndpoint,
  downstreamChannelEndpoint,
} from './AudioChannelEndpoints';

// noauth routes
router.get('/downstream/channel/:channelId', downstreamChannelEndpoint);

// authed routes
router.post('/authed/requestchannel', requestChannelAuthedEndpoint);
router.post('/authed/upstream', upstreamHLSAuthedEndpoint);
router.post('/authed/clearchannel', clearChannelAuthedEndpoint);

module.exports = router;
