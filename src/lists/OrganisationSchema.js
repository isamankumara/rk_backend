const { Text, Relationship, Url, Virtual } = require('@keystonejs/fields');
const { getPresignedUrl } = require('../utils/AWSUtil');

module.exports = {
  queryLimits: {
    maxResults: 1000,
  },
  fields: {
    identifier: {
      type: Text,
      isRequired: true,
    },
    name: {
      type: Text,
      isRequired: true,
    },
    users: {
      type: Relationship,
      ref: 'User.organisation',
      many: true,
    },
    themes: {
      type: Relationship,
      ref: 'Theme.organisation',
      many: true,
    },
    questions: {
      type: Relationship,
      ref: 'Question.organisation',
      many: true,
    },
    playableItems: {
      type: Relationship,
      ref: 'PlayableItem.organisation',
      many: true,
    },
    tags: {
      type: Relationship,
      ref: 'Tag.organisation',
      many: true,
    },
    tasksBaseRoute: {
      type: Url,
    },
    logoMediaAsset: {
      type: Relationship,
      ref: 'MediaAsset',
    },

    logoURL: {
      type: Virtual,
      resolver: async (item, args, context) => {
        try {
          if (item.logoMediaAsset) {
            const logoMediaAssetId = item.logoMediaAsset.toString();
            const { data } = await context.executeGraphQL({
              query: ` query {
                MediaAsset(where: { id: "${logoMediaAssetId}" })
                { 
                  s3key
                }
              }`,
            });
            const url = await getPresignedUrl(data.MediaAsset.s3key);
            return url;
          } else {
            return '';
          }
        } catch (err) {
          console.error(err);
        }
      },
    },
  },
};
