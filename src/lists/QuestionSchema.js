const { Text, Relationship, Select } = require('@keystonejs/fields');

module.exports = {
  queryLimits: {
    maxResults: 1000,
  },
  fields: {
    organisation: {
      type: Relationship,
      ref: 'Organisation.questions',
    },
    identifier: {
      type: Text,
      isRequired: true,
      isUnique: true,
    },

    title: {
      type: Text,
      isRequired: true,
    },

    type: {
      type: Select,
      options: [
        { value: 'QUESTION', label: 'Question' },
        { value: 'BRANCH', label: 'Question branch' },
      ],
      isRequired: true,
      defaultValue: 'VIDEO',
    },
    audioFileLow: {
      type: Relationship,
      ref: 'MediaAsset',
    },
    audioFileHigh: {
      type: Relationship,
      ref: 'MediaAsset',
    },
    rightPathLabel: {
      type: Text,
      defaultValue: 'Yes',
    },

    leftPathLabel: {
      type: Text,
      defaultValue: 'No',
    },
  },
};
