const { Text, Relationship, Virtual } = require('@keystonejs/fields');
const { executeGQL } = require('../controllers/GQL');
const {
  rawQuestionCount,
} = require('../services/topic/helpers/TopicMetadataHelper');

const resolveInput = async ({ resolvedData }) => {
  // do a pretty print on metadata property (which will validate for JSON well formedness)
  if (!resolvedData) return;
  let resolvedMetadata;
  try {
    if (resolvedData.metadata && resolvedData.metadata.length > 0) {
      const parsedData = JSON.parse(resolvedData.metadata);

      // re-stringify to pretty print
      resolvedMetadata = JSON.stringify(parsedData, null, 2);

      return resolvedMetadata;
    }
  } catch (err) {
    return `JSON FORMAT ERROR: ${err.message}\n${resolvedData.metadata}`;
  }
};

module.exports = {
  labelResolver: item => item.title,
  queryLimits: {
    maxResults: 1000,
  },
  fields: {
    identifier: {
      type: Text,
      isRequired: true,
    },
    title: {
      type: Text,
      isRequired: true,
    },

    sequence: {
      type: Text,
      isRequired: true,
      defaultValue: 'zzzz',
    },

    theme: {
      type: Relationship,
      ref: 'Theme.topics',
    },

    stories: {
      type: Relationship,
      ref: 'Story.topic',
      many: true,
    },

    metadata: {
      type: Text,
      isMultiline: true,
      hooks: {
        resolveInput,
      },
    },

    duration: {
      type: Text,
      defaultValue: 'HH:MM',
      isMultiline: false,
      isRequired: true,
    },

    questionCount: {
      type: Virtual,
      resolver: item => {
        if (item.metadata) return `${rawQuestionCount(item.metadata)}`;
        else return `Not available`;
      },
    },

    hasUserCompletedTopic: {
      type: Virtual,
      resolver: async (item, args, context) => {
        const { allStories } = await executeGQL(`query {
          allStories (
            where: { AND: 
              [{
                interviewer: {
                  id: "${context.authedItem}"
                },
                topic: {
                  id: "${item.id}"
                }
                OR: [
                  { status: PUBLISHED },
                  { status: PUBLISHED_FINALISED },
                ]
                    }]
            }
          )
            {
              id
            }
          }`);

        return allStories.length > 0 ? 'COMPLETED' : 'UNCOMPLETED';
      },
    },
  },
};
