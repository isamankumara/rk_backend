const { Text, Relationship, Checkbox, Virtual } = require('@keystonejs/fields');

module.exports = {
  labelResolver: item => item.title,
  queryLimits: {
    maxResults: 1000,
  },
  fields: {
    title: {
      type: Text,
      isRequired: true,
    },
    users: {
      type: Relationship,
      ref: 'User',
      many: true,
    },
    stories: {
      type: Relationship,
      ref: 'Story',
      many: true,
    },
    isPublic: {
      type: Checkbox,
      defaultValue: false,
    },
    playlistStatus: {
      type: Text,
      isRequired: true,
    },
    creator: {
      type: Relationship,
      ref: 'User',
    },
    orgIdentifier: {
      type: Virtual,
      resolver: async (item, args, context) => {
        try {
          const { data } = await context.executeGraphQL({
            query: ` query {
            Playlist(where: { id: "${item.id}" })
            { 
              creator {
                organisation {
                  identifier
                }
              }
            }
          }`,
          });
          return data.Playlist.creator.organisation.identifier;
        } catch (err) {
          return 'n/a';
        }
      },
    },
  },
};
