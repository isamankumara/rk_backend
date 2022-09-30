const { interviewerReturnFragment } = require('./interviewerFragment');

module.exports = {
  storyReturnFragment: `
  id
  title
  isPublic
  likes
  status
  metadata
  progress
  duration
  hasUserLikedStory
  hasUserBookmarkedStory
  interviewer {
    ${interviewerReturnFragment}
  }
  storyTellers {
    ${interviewerReturnFragment}
  }
  tags {
    id
    title
  }
  topic {
    id
    title
  }
  orgIdentifier
`,

  storyTracksReturnFragment: `
  id
  title
  interviewer {
    username
    avatarImageMediaAsset {
      url
    }
  }
  status
  metadata
  audioFile {
    duration
    url
  }
  audioChannels {
    id
    status
    audioFile {
      duration
      url
    }
  }
  duration
  `,
};
