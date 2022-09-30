import { AudioChannelSampleRate } from '../ts/types/contentTypes';
import { getItems } from '../controllers/GQL';

export const getQuestionBundleAudioFileLocation = (
  identifier: string,
  sampleRate: AudioChannelSampleRate
) => {
  // need to insert sample rate into identifier so it can be found in question bundle bucket
  const qIdentParts = identifier.split('/');
  qIdentParts.splice(qIdentParts.length - 1, 0, `${sampleRate}`);
  return qIdentParts.join('/');
};

export const validateOrgIdent = async (orgIdent: string): Promise<boolean> => {
  const orgs = await getItems(
    'Organisation',
    { identifier: orgIdent },
    `organisation {
    identifier
  }`
  );
  return orgs.length > 0;
};
