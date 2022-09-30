import express from 'express';
export const router = express.Router();

import {
  preflightContentEndpoint,
  synchroniseContentEndpoint,
  auditContentEndpoint,
  cleardownContentEndpoint,
} from './ContentEndpoints';

router.get('/preflight/:orgIdent', preflightContentEndpoint);
router.put('/synchronise/:orgIdent', synchroniseContentEndpoint);
router.put('/cleardown/:orgIdent', cleardownContentEndpoint);
router.put('/audit', auditContentEndpoint);
module.exports = router;
