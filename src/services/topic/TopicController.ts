import { getItem } from '../../controllers/GQL';
import { packageTopicMetadata } from './helpers/TopicMetadataHelper';
import { MongoId, TopicMetadata } from '../../ts/types/contentTypes';

export async function packageTopicForPlayback(
  topicId: MongoId,
  orgIdent: string
): Promise<TopicMetadata> {
  const topic = await getItem(
    'Topic',
    topicId,
    `id 
    type
    title
    metadata
    duration
    `
  );
  return await packageTopicMetadata(topic.metadata, orgIdent);
}
