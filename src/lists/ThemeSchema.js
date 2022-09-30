const { Text, Relationship, Checkbox } = require('@keystonejs/fields');

module.exports = {
  labelResolver: item => item.title,
  queryLimits: {
    maxResults: 1000,
  },
  fields: {
    organisation: {
      type: Relationship,
      ref: 'Organisation.themes',
    },
    identifier: {
      type: Text,
      isRequired: true
    },
    title: {
      type: Text,
      isRequired: true
    },    
    subText: {
      type: Text,
    },
    previewImage: {
      type: Relationship,
      ref: 'MediaAsset'
    },
    topics: {
      type: Relationship,
      ref: 'Topic.theme',
      many: true,
    },

    isPublic: {
      type: Checkbox,
      defaultValue: false
    }
  }
}
