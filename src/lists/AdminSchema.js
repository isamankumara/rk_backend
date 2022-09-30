const { Text, Password } = require('@keystonejs/fields');
module.exports = {
  queryLimits: {
    maxResults: 1000,
  },
  fields: {
    name: {
        type: Text,
        isRequired: true,
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
  }
}