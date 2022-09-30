import { Response } from 'express';
import { AuthedRequest } from '../../ts/types/expressTypes';
import { packageTopicForPlayback } from './TopicController';
import { getUserOrg } from '../../utils/UserUtil';

export const getTopicPlaybackMetadataAuthedEndpoint = async function (
  req: AuthedRequest<{ params: { topicId: string } }>,
  res: Response
): Promise<void> {
  try {
    const { topicId } = req.params;
    const { identifier: orgIdent } = await getUserOrg(req.user.id);
    const packagedMetadata = await packageTopicForPlayback(topicId, orgIdent);
    res.status(200).json(packagedMetadata);
  } catch (error) {
    console.error('getTopicPlaybackMetadataAuthedEndpoint ', error);
    res.status(500).json({
      message: `An error has occurred: ${error}`,
    });
  }
};
