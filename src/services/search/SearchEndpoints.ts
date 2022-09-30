import { Response } from 'express';
import { AuthedRequest } from '../../ts/types/expressTypes';
import {
  searchStories,
  getAllPublicStories,
  searchUsernames,
} from './SearchController';
import { getUserOrg } from '../../utils/UserUtil';

export const searchStoriesAuthedEndpoint = async (
  req: AuthedRequest<{ query: { tag_id: string; search: string } }>,
  res: Response
): Promise<void> => {
  try {
    const { tag_id, search } = req.query;
    const { identifier: orgIdent } = await getUserOrg(req.user.id);
    const stories = await searchStories(orgIdent, tag_id, search);
    res.status(200).send(stories);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  }
};
export const getAllPublicStoriesAuthedEndpoint = async (
  req: AuthedRequest<{ params: { skip: string } }>,
  res: Response
): Promise<void> => {
  try {
    const { skip } = req.params;
    const { identifier: orgIdent } = await getUserOrg(req.user.id);
    const stories = await getAllPublicStories(orgIdent, skip);
    res.status(200).send(stories);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  }
};
export const searchUsernamesAuthedEndpoint = async (
  req: AuthedRequest<{ params: { searchTerm: string } }>,
  res: Response
): Promise<void> => {
  try {
    const { searchTerm } = req.params;
    const { identifier: orgIdent } = await getUserOrg(req.user.id);
    const users = await searchUsernames(orgIdent, searchTerm);
    res.status(200).send(users);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  }
};
