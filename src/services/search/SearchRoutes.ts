import express from 'express';
export const router = express.Router();

import {
  searchStoriesAuthedEndpoint,
  getAllPublicStoriesAuthedEndpoint,
  searchUsernamesAuthedEndpoint,
} from './SearchEndpoints';

// noauth routes

// authed routes
router.get(
  '/authed/searchusernames/:searchTerm',
  searchUsernamesAuthedEndpoint
);
router.get('/authed', searchStoriesAuthedEndpoint);
router.get('/authed/allpublicstories', getAllPublicStoriesAuthedEndpoint);
router.get('/authed/allpublicstories/:skip', getAllPublicStoriesAuthedEndpoint);
module.exports = router;
