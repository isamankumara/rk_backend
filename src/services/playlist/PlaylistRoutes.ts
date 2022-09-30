import express from 'express';
export const router = express.Router();

import {
  createPlaylistAuthedEndpoint,
  getPlaylistByIdAuthedEndpoint,
  getUserPlaylistsAuthedEndpoint,
  deletePlaylistAuthedEndpoint,
  updatePlaylistDetailsAuthedEndpoint,
  getStoriesByPlaylistAuthedEndpoint,
} from './PlaylistEndpoints';

// authed routes
router.post('/authed/create', createPlaylistAuthedEndpoint);
router.get('/authed/:playlistId', getPlaylistByIdAuthedEndpoint);
router.get('/authed', getUserPlaylistsAuthedEndpoint);
router.get('/authed/stories/:playlistId', getStoriesByPlaylistAuthedEndpoint);
router.put('/authed/update/:playlistId', updatePlaylistDetailsAuthedEndpoint);
router.delete('/authed/:playlistId', deletePlaylistAuthedEndpoint);

module.exports = router;
