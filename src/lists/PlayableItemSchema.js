const { Text, Select, Relationship, Integer } = require('@keystonejs/fields');

module.exports = {
  labelResolver: item => `${item.title} (${item.type})`,
  queryLimits: {
    maxResults: 1000,
  },
  fields: {
    organisation: {
      type: Relationship,
      ref: 'Organisation.playableItems',
    },  
    title: {
      type: Text,
      isRequired: true,
    },
    type: { type: Select, 
      options: [
        { value: 'VIDEO', label: "Video played from S3" },
        { value: 'AUDIO', label: "Audio played from S3" },
      ],
      isRequired: true,
      defaultValue: 'VIDEO'
    },
    item: {
      type: Relationship,
      ref: 'MediaAsset'
    },
    previewImage: {
      type: Relationship,
      ref: 'MediaAsset'
    },
    order: {
      type: Integer,
      defaultValue: 0
    },
    playbackIconColor: { type: Text, 
      defaultValue: '#FFFFFF'
    },
    tags: {
      type: Relationship,
      ref: 'Tag',
      many: true
    }
  }
}
