import { Response } from 'express';

// Controller
import { getAllUserTags, getAllTags } from './TagController';

// Helpers
import { getUserOrg } from '../../utils/UserUtil';

// TS
import { AuthedRequest } from '../../ts/types/expressTypes';

export const getAllUserTagsAuthedEndpoint = async (
  req: AuthedRequest<{ params: { tagType: string } }>,
  res: Response
): Promise<void> => {
  try {
    const { tagType } = req.params;
    const { identifier: orgIdent } = await getUserOrg(req.user.id);
    const userTags = await getAllUserTags(orgIdent, tagType);
    res.status(200).send(userTags);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  }
};

export const getAllTagsAuthedEndpoint = async (
  req: AuthedRequest,
  res: Response
): Promise<void> => {
  try {
    const { identifier: orgIdent } = await getUserOrg(req.user.id);
    const allTags = await getAllTags(orgIdent);
    res.status(200).send(allTags);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  }
};
