const { Text, Select, Integer, Relationship } = require('@keystonejs/fields');
const { atTracking } = require('@keystonejs/list-plugins');
const { dbAtTrackingTimeFormat } = require('../appConstants');

module.exports = {
  labelResolver: item => `${item.id} (${item.status})`,
  queryLimits: {
    maxResults: 1000,
  },
  fields: {
    status: { type: Select, 
      options: [
        { value: 'RECORDING', label: "Recording" },
        { value: 'SAVED', label: "Saved" },
        { value: 'PUBLISHED', label: "Published" },
        { value: 'PUBLISHED_FINALISED', label: "Published and finalised" },
        { value: 'ARCHIVED', label: "Archived"},
        { value: 'DELETED', label: "Deleted"},
      ],
      isRequired: true,
      defaultValue: 'RECORDING'
    },
    story: {
      type: Relationship,
      ref: 'Story.audioChannels'
    },
    duration: {
      type: Text,
      defaultValue: '0'
    },
    chunks: {
      type: Text,
      defaultValue: '[]'
    },
    sampleRate: {
      type: Integer,
      isRequired: true,
      defaultValue: 30000
    },
    inputChannels: {
      type: Integer,
      isRequired: true,
      defaultValue: 1
    },
    audioFile: {
      type: Relationship,
      ref: 'MediaAsset',
    },
  
  },
  plugins: [
    atTracking({
      format: dbAtTrackingTimeFormat,
      read: true,
      create: false,
      update: false
    }),
  ],
}
