import express from 'express';
export const router = express.Router();

import {
  getAllUserTagsAuthedEndpoint,
  getAllTagsAuthedEndpoint,
} from './TagEndpoints';

router.get('/authed', getAllTagsAuthedEndpoint);
router.get('/authed/:tagType', getAllUserTagsAuthedEndpoint);
module.exports = router;
