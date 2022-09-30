const userReturnFragment = `
  id
  firstName
  lastName
  username
  emailAddress
  mobileNumber
  bookmarks {
    id
  }
  likedStories {
    id
  }
  avatarImageMediaAsset {
    url
  }
`;

module.exports = {
  userReturnFragment,
};
