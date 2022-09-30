const {
  Text,
  Relationship,
  Checkbox,
  Select,
  Virtual,
  Integer
} = require('@keystonejs/fields');
const { atTracking } = require('@keystonejs/list-plugins');
const { dbAtTrackingTimeFormat } = require('../appConstants');

module.exports = {
  queryLimits: {
    maxResults: 1000,
  },
  fields: {
    title: {
      type: Text,
    },

    status: {
      type: Select,
      options: [
        { value: 'RECORDING', label: 'Story is being recorded' },
        {
          value: 'SAVED',
          label: 'Saved (unpublished) story recording session',
        },
        { value: 'PUBLISHED', label: 'Published story' },
        {
          value: 'PUBLISHED_FINALISED',
          label: 'Published and finalised story',
        },
        { value: 'DELETED', label: 'Deleted story' },
        { value: 'OFFLINE', label: 'Story is offline' },
      ],
      isRequired: true,
      defaultValue: 'RECORDING',
    },
    // metadata is used to describe a saved story recording session
    // and is seeded from the topic metadata on which the story is based
    metadata: {
      type: Text,
      isMultiline: true,
    },

    isPublic: {
      type: Checkbox,
      defaultValue: false,
    },

    interviewer: {
      type: Relationship,
      ref: 'User',
    },

    storyTellers: {
      type: Relationship,
      ref: 'User',
      many: true,
    },

    topic: {
      type: Relationship,
      ref: 'Topic.stories',
    },

    audioChannels: {
      type: Relationship,
      ref: 'AudioChannel.story',
      many: true,
    },

    duration: {
      type: Text,
    },
    progress: {
      type: Integer,
      defaultValue: 0,
    },

    tags: {
      type: Relationship,
      ref: 'Tag',
      many: true,
    },

    likes: {
      type: Virtual,
      graphQLReturnType: `Int`,
      resolver: async (item, args, context) => {
        try {
          const { data } = await context.executeGraphQL({
            query: ` query {
            Story(where: { id: "${item.id}" })
            { 
              likedByUsers {
                id
              }
            }
          }`,
          });
          return data.Story.likedByUsers.length;
        } catch (err) {
          return 0;
        }
      },
    },

    likedByUsers: {
      type: Relationship,
      ref: 'User.likedStories',
      many: true,
    },

    audioFile: {
      type: Relationship,
      ref: 'MediaAsset',
    },
    orgIdentifier: {
      type: Virtual,
      resolver: async (item, args, context) => {
        try {
          const { data } = await context.executeGraphQL({
            query: ` query {
            Story(where: { id: "${item.id}" })
            { 
              interviewer {
                organisation {
                  identifier
                }
              }
            }
          }`,
          });
          return data.Story.interviewer.organisation.identifier;
        } catch (err) {
          return "n/a";
        }
      },
    },
  },
  plugins: [
    atTracking({
      format: dbAtTrackingTimeFormat,
      read: true,
      create: false,
      update: false,
    }),
  ],
};
