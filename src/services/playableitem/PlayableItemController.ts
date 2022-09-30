import { executeGQL } from '../../controllers/GQL';

// Get All playable items tagged with the specified tag
export async function getPlayableItems(orgIdent: string, tag: string) {
  const getAllPlayableItemsQuery = ` query {
    allPlayableItems (sortBy: order_ASC, 
      where: {
        tags_some: { 
          title: "${tag}" 
        },
        organisation: {
          identifier: "${orgIdent}"
        } 
      } ) { 
      id
      title
      order
      likes
      type
      playbackIconColor
      item {
        type
        s3key
        url
      }
      previewImage {
        type
        s3key
        url
      }
    }
  }`;

  const { allPlayableItems } = await executeGQL(getAllPlayableItemsQuery);

  return allPlayableItems;
}