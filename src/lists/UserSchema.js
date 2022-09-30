const { Text, Virtual, Password, Relationship } = require('@keystonejs/fields');
const { getPresignedUrl } = require('../utils/AWSUtil');
module.exports = {
  queryLimits: {
    maxResults: 1000,
  },
  fields: {
    organisation: {
      type: Relationship,
      ref: 'Organisation.users',
    },
    firstName: {
      type: Text,
      isRequired: true,
    },

    lastName: {
      type: Text,
      isRequired: true,
    },

    username: {
      type: Text,
      isRequired: true,
      unique: true,
    },

    emailAddress: {
      type: Text,
      isRequired: true,
      unique: true,
    },

    password: {
      type: Password,
      isRequired: true,
    },

    avatarImageMediaAsset: {
      type: Relationship,
      ref: 'MediaAsset',
    },

    avatarURL: {
      type: Virtual,
      resolver: async (item, args, context) => {
        try {
          if (item.avatarImageMediaAsset) {
            const avatarImageMediaAssetId = item.avatarImageMediaAsset.toString();
            const { data } = await context.executeGraphQL({
              query: ` query {
                MediaAsset(where: { id: "${avatarImageMediaAssetId}" })
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

    bookmarks: {
      type: Relationship,
      ref: 'Story',
      many: true,
    },

    location: {
      type: Text,
    },

    likedStories: {
      type: Relationship,
      many: true,
      ref: 'Story.likedByUsers',
    },

    mobileNumber: {
      type: Text,
    },
    orgIdentifier: {
      type: Virtual,
      resolver: async (item, args, context) => {
        try {
          const { data } = await context.executeGraphQL({
            query: ` query {
            User(where: { id: "${item.id}" })
            { 
              organisation {
                identifier
              }
            }
          }`,
          });
          return data.User.organisation.identifier;
        } catch (err) {
          return 'n/a';
        }
      },
    },
  },
};
