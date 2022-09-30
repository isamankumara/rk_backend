import { Response } from 'express';
import { MongoId, PlaylistStatus } from '../../ts/types/contentTypes';

// TS
import { AuthedRequest } from '../../ts/types/expressTypes';

// Controller
import { createPlaylist, deletePlaylist, getAllPlaylists, updatePlaylistDetails, getPlaylistDetails } from './PlaylistController';


export const getPlaylistByIdAuthedEndpoint = async (
  req: AuthedRequest<{params: { playlistId: string }}>,
  res: Response
): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const playlist = await getPlaylistDetails(playlistId);
    res.status(200).send(playlist);
  } catch (error) {
    res.status(500).send({ message: error });
  }
};

export const getUserPlaylistsAuthedEndpoint = async (
  req: AuthedRequest,
  res: Response
): Promise<void> => {
  try {
    const playlists = await getAllPlaylists(req.user.id);
    res.status(200).send(playlists);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: error,
    });
  }
};

export const getStoriesByPlaylistAuthedEndpoint = async (
  req: AuthedRequest,
  res: Response
): Promise<void> => {
  try {
    console.info('getStoriesByPlaylistAuthedEndpoint');
  } catch (error) {
    console.error('getStoriesByPlaylistAuthedEndpoint ', error);
    res.status(500).send({ message: error });
  }
};

export const createPlaylistAuthedEndpoint = async (
  req: AuthedRequest<{
    body: {
      title: string;
      isPublic: boolean;
      users: MongoId[];
      stories: MongoId[];
      playlistStatus: PlaylistStatus;
    };
  }>,
  res: Response
): Promise<void> => {
  try {
    const { title, users, stories, isPublic , playlistStatus} = req.body;
    const playlist = await createPlaylist(req.user.id,title, users, stories, isPublic, playlistStatus);
    res.status(200).send(playlist);
  } catch (error) {
    console.error('createPlaylistAuthedEndpoint ', error);
    res.status(500).send({ message: error });
  }
};

export const updatePlaylistDetailsAuthedEndpoint = async (
  req: AuthedRequest<{
    params: { playlistId: string };
    body: {
      playlistDetails: {
        title: string;
        isPublic: boolean;
        users: MongoId[];
        stories: MongoId[];
        playlistStatus: PlaylistStatus
      };
    };
  }>,
  res: Response
): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const { title, users, stories, isPublic, playlistStatus } = req.body.playlistDetails;
    const playlist = await updatePlaylistDetails(playlistId,title, users, stories, isPublic, playlistStatus);
    res.status(200).send(playlist);  } catch (error) {
    console.error(error);
    res.status(500).send({
      message: `An error has occurred: ${error}`,
    });
  }
};

export const deletePlaylistAuthedEndpoint = async (
  req: AuthedRequest<{ params: { playlistId: MongoId } }>,
  res: Response
): Promise<void> => {
  try {
    const { playlistId } = req.params;
    const deletedItem = await deletePlaylist(playlistId);
    res.status(200).send(deletedItem);
  } catch (error) {
    console.error(error);
    res.status(500).send({
      message: `An error has occurred: ${error}`,
    });
  }
};
