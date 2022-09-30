import { executeGQLWithAuthedItem, getItem } from '../../controllers/GQL';
import { MongoId, MediaAsset, Topic } from '../../ts/types/contentTypes';

export async function getUserThemes(
  userId: MongoId
): Promise<
  Array<{
    id: MongoId;
    identifier: string;
    title: string;
    subText: string;
    previewImage: MediaAsset;
    topics: Array<Topic>;
  }>
> {
  const user = await getItem(
    'User',
    userId,
    `id
    organisation {
      id
    }`
  );
  const { allThemes } = await executeGQLWithAuthedItem(
    `query {
    allThemes (sortBy: title_ASC,
      where: {
        organisation: {
          id: "${user.organisation.id}"
        }
      }) { 
      id
      identifier
      title
      subText
      previewImage {
        url
      }
      topics (sortBy: sequence_ASC) {
        id
        identifier
        sequence
        title
        questionCount
        duration
        hasUserCompletedTopic
      }
    }
  }`,
    userId,
    'Topic'
  );

  return allThemes;
}

module.exports = { getUserThemes };
