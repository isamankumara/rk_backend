const { creatorReturnFragment } = require('./creatorFragment');
const { storyReturnFragment } = require('./storyFragment');
const { userReturnFragment } = require('./userFragment');

const playlistReturnFragment = `
  id
  title
  isPublic
  users {
    id
    firstName
    lastName
  }
  stories {
    ${storyReturnFragment}
  }
  creator {
    ${creatorReturnFragment}
   }
`;

module.exports = {
  playlistReturnFragment,
};
