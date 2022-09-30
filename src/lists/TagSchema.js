const { Text, Select, Url, Relationship } = require('@keystonejs/fields');

module.exports = {
  labelResolver: item => `${item.title} (${item.context})`,
  queryLimits: {
    maxResults: 1000,
  },
  fields: {
    organisation: {
      type: Relationship,
      ref: 'Organisation.tags',
    },
    title: {
      type: Text,
      isRequired: true
    },
    
    subText: {
      type: Text,
      isRequired: false,
    },

    url: {
      type: Url,
      isRequired: false,
    },

    context: { type: Select, 
      options: [
        { value: 'USER', label: "Tag for user content" },
        { value: 'INTERNAL', label: "Tag for internal content" },
        { value: 'HELP_TIP', label: "Help tips for users"},
        { value: 'HELP_TIP_RECORDING', label: "Help tips while recording"},
      ],
      isRequired: true,
      defaultValue: 'USER'
    },
  }
}
