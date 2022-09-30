import { getPlayableItems } from './PlayableItemController';
import { getUserOrg } from '../../utils/UserUtil';
import { Response } from 'express';
import { AuthedRequest } from '../../ts/types/expressTypes';

export const getPlayableItemsAuthedEndpoint = async (
  req: AuthedRequest<{ params: { tag: string } }>,
  res: Response
): Promise<void> => {
  try {
    const { tag } = req.params;
    const { identifier: orgIdent } = await getUserOrg(req.user.id);
    const playableItems = await getPlayableItems(orgIdent, tag);
    res.status(200).send(playableItems);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  }
};
