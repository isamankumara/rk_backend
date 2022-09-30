import { MongoId, Playlist, PlaylistStatus } from '../../ts/types/contentTypes';
import {
  createItem,
  deleteItem,
  getItems,
  getItem,
  one2ManyGQLExpand,
  updateItem,
} from '../../controllers/GQL';
import { playlistReturnFragment } from '../../fragments/playlistFragment';
import { creatorReturnFragment } from '../../fragments/creatorFragment';


const getInput = (title: string,
  users: MongoId[],
  stories: MongoId[],
  isPublic: boolean,
  playlistStatus: PlaylistStatus,
  userId: MongoId) => {

    const input : any = {
      title: title,
      isPublic: isPublic,
      playlistStatus: playlistStatus
    } ;
  
    if (users != undefined && users.length > 0) {
      input.users = {
        disconnectAll: true,
        connect: one2ManyGQLExpand(users),
      }
    }
    if (stories != undefined && stories.length > 0) {
      input.stories = {
        disconnectAll: true,
        connect: one2ManyGQLExpand(stories),
      }
    }
    if (userId != null ) {
      input.creator = {
        connect: { id: userId },
      }
    }

    return input;
}
//
export const createPlaylist = async (
  userId: MongoId,
  title: string,
  users: MongoId[],
  stories: MongoId[],
  isPublic: boolean,
  playlistStatus: PlaylistStatus
): Promise<{
  id: MongoId;
  title: string;
  isPublic: boolean;
  users: MongoId[];
  stories: MongoId[];
  playlistStatus: PlaylistStatus;
  creator: {
    id: MongoId;
    username: string;
  }
}> => {
  const playlist = await createItem(
    'Playlist',
    getInput(title,users,stories,isPublic, playlistStatus, userId),
    playlistReturnFragment
  );
  return playlist;
};

export const updatePlaylistDetails = async (
  playlistId: MongoId,
  title: string,
  users: MongoId[],
  stories: MongoId[],
  isPublic: boolean,
  playlistStatus: PlaylistStatus
): Promise<Playlist> => {
  const updatedPlaylist: Playlist = await updateItem(
    'Playlist',
    playlistId,
    getInput(title,users,stories,isPublic,playlistStatus, null),
    playlistReturnFragment
  );
  return updatedPlaylist;
};

export const getAllPlaylists = async userId  => {
  const playlists = await getItems('Playlist',{
    OR:[{creator:{id: userId}}, {users_some:{id: userId}}]
  }, 'id title')
  return playlists;
}

export const deletePlaylist = async (id: MongoId) => {
  const deletedItem = await deleteItem('Playlist',id)
  return deletedItem;
}

export const getPlaylistDetails = async (id: MongoId) => {
  const playlist = await getItem('Playlist',id,playlistReturnFragment)
  return playlist;
}