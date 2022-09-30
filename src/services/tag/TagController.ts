import { executeGQL, getItems } from '../../controllers/GQL';

export async function getAllUserTags(orgIdent: string, tagType: string) {
  const { allTags } = await executeGQL(` query {
      allTags (sortBy: title_ASC, 
        where: { 
          context: ${tagType}
          organisation: {
            identifier: "${orgIdent}"
          }
        })
        { 
          id
          title
          subText
          }
        }`);

  return allTags;
}

export async function getAllTags(orgIdent: string) {
  const allTags = await getItems(
    'Tag',
    {
      organisation: {
        identifier: orgIdent,
      },
    },
    'id title subText context'
  );

  return allTags;
}
