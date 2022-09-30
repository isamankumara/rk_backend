import express from 'express';
export const router = express.Router();

import { getAllThemesAuthedEndpoint } from './ThemeEndpoints';

router.get('/authed', getAllThemesAuthedEndpoint);
module.exports = router;
