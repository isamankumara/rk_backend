const { getItems, deleteItem } = require('./GQL');

const { storyReturnFragment } = require('../fragments/storyFragment');

const aws = require('aws-sdk');

const {
  OPERATIONAL_BUCKET,
  AWS_ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY,
  MEDIA_ASSET_SOURCE_BUCKET,
} = process.env;
const s3 = new aws.S3({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

const getQuestionAudioMediaAssetKeys = async () => {
  try {
    const questionAudioFileKeys = [];

    // First elicit question audio identifiers
    // assume each question and subquestion has a corresponding audio file
    const questions = await getItems(
      'Question',
      {},
      `id
      audioFile {
        s3key
      }`
    );

    for (const question of questions) {
      if (question.audioFile)
        questionAudioFileKeys.push(question.audioFile.s3key);
    }

    return questionAudioFileKeys;
  } catch (err) {
    console.error(err);
  }
};

const getStoryAudioMediaAssetKeys = async () => {
  try {
    const storyAudioFileKeys = [];

    //  Elicit PUBLISHED story audio identifiers
    const stories = await getItems(
      'Story',
      {
        OR: [{ status: 'PUBLISHED' }, { status: 'PUBLISHED_FINALISED' }],
      },
      storyReturnFragment
    );

    let story;
    for (story of stories) {
      if (story.responseAudioFile)
        storyAudioFileKeys.push(story.responseAudioFile.s3key);
    }

    return storyAudioFileKeys;
  } catch (err) {
    console.error(err);
  }
};

const getUserAvatarMediaAssetKeys = async () => {
  try {
    const avatarMediaAssetKeys = [];

    //  Elicit avatar media asset identifiers
    const users = await getItems(
      'User',
      {},
      `avatarImageMediaAsset {
        s3key
      }`
    );
    for (const user of users) {
      if (user.avatarImageMediaAsset)
        avatarMediaAssetKeys.push(user.avatarImageMediaAsset.s3key);
    }

    return avatarMediaAssetKeys;
  } catch (err) {
    console.error(err);
  }
};

const getPlayableItemMediaAssetKeys = async () => {
  try {
    const playableItemMediaAssetKeys = [];

    const playables = await getItems(
      'PlayableItem',
      {},
      `item {
        s3key
      }
      previewImage {
        s3key
      }`
    );
    for (const playable of playables) {
      if (playable.item) playableItemMediaAssetKeys.push(playable.item.s3key);
      if (playable.previewImage)
        playableItemMediaAssetKeys.push(playable.previewImage.s3key);
    }

    return playableItemMediaAssetKeys;
  } catch (err) {
    console.error(err);
  }
};

const auditMediaAssets = async (req, res) => {
  try {
    const { logToConsole } = req.body;

    const questionAudioMediaAssetKeys = await getQuestionAudioMediaAssetKeys();
    const storyAudioMediaAssetKeys = await getStoryAudioMediaAssetKeys();
    const userAvatarMediaAssetKeys = await getUserAvatarMediaAssetKeys();
    const playableItemMediaAssetKeys = await getPlayableItemMediaAssetKeys();
    const amalgamatedKeys = [
      ...questionAudioMediaAssetKeys,
      ...storyAudioMediaAssetKeys,
      ...userAvatarMediaAssetKeys,
      ...playableItemMediaAssetKeys,
    ];
    if (logToConsole)
      console.log(
        '================================\nStarting media asset audit'
      );
    const discrepancies = [];
    // run two passes
    // first, check identifiers against S3
    // second, check identifiers against the overall MediaAsset collection

    const data = await s3.listObjects({ Bucket: OPERATIONAL_BUCKET }).promise();

    // remove the 'media/' prefix from each s3 key
    const s3Items = data.Contents.map(i => i.Key.split('/')[1]);

    // first look for s3 items not referenced by the DB
    for (const item of s3Items) {
      const index = amalgamatedKeys.indexOf(item);
      if (index === -1) {
        discrepancies.push(`S3 object "${item}" is not referenced
          by database.`);
      }
    }

    // second look for db items not available in s3
    for (const key of questionAudioMediaAssetKeys) {
      const index = s3Items.indexOf(key);
      if (index === -1) {
        discrepancies.push(
          `Question audio media asset "${key}" not found in S3 bucket.`
        );
      }
    }
    for (const key of storyAudioMediaAssetKeys) {
      const index = s3Items.indexOf(key);
      if (index === -1) {
        discrepancies.push(
          `Story audio media asset "${key}" not found in S3 bucket.`
        );
      }
    }
    for (const key of userAvatarMediaAssetKeys) {
      const index = s3Items.indexOf(key);
      if (index === -1) {
        discrepancies.push(
          `User profile image media asset "${key}" not found in S3 bucket.`
        );
      }
    }

    for (const key of playableItemMediaAssetKeys) {
      const index = s3Items.indexOf(key);
      if (index === -1) {
        discrepancies.push(
          `Playable item media asset "${key}" not found in S3 bucket.`
        );
      }
    }

    // TODO: add additional checks to check total of each type of media asset
    // against the 3 kinds

    // TODO: send maintenance email containing discrepancies

    if (logToConsole)
      console.log(
        'Audit media assets found discrepancies:\n ',
        discrepancies,
        '\n================================'
      );
    if (res) res.status(200).send(discrepancies);
    return;
  } catch (err) {
    console.error(err);
    if (res) res.status(500).send(err);
  }
};

// deletes all DB and S3 objects of the given type
// type is one of:
// USER_PROFILE_IMAGE
// STORY_RESPONSE_AUDIO
// QUESTION_AUDIO
// PLAYABLE_VIDEO
// PLAYABLE_AUDIO
// PLAYABLE_ITEM_PREVIEW_IMAGE
const deleteMediaAssetsByType = async type => {
  const mediaAssets = await getItems(
    'MediaAsset',
    { type },
    `id
  s3key`
  );

  for (const mediaAsset of mediaAssets) {
    try {
      await s3
        .deleteObject({
          Bucket: OPERATIONAL_BUCKET,
          Key: `media/${mediaAsset.s3key}`,
        })
        .promise();
    } catch (err) {
      console.error(`Unable to delete ${mediaAsset.s3key} from S3`);
    }
    await deleteItem('MediaAsset', mediaAsset.id);
  }
};

const mediaAssetTypeToBucketFolder = type => {
  switch (type) {
    case 'USER_PROFILE_IMAGE':
    case 'STORY_RESPONSE_AUDIO':
      return [OPERATIONAL_BUCKET, 'media'];
    case 'QUESTION_AUDIO':
      return [MEDIA_ASSET_SOURCE_BUCKET, 'QUESTION_AUDIO'];
    case 'PLAYABLE_VIDEO':
      return [MEDIA_ASSET_SOURCE_BUCKET, 'PLAYABLE_VIDEO'];
    case 'PLAYABLE_AUDIO':
      return [MEDIA_ASSET_SOURCE_BUCKET, 'PLAYABLE_AUDIO'];
    case 'PLAYABLE_ITEM_PREVIEW_IMAGE':
      return [MEDIA_ASSET_SOURCE_BUCKET, 'PLAYABLE_ITEM_PREVIEW_IMAGE'];
  }
};

module.exports = {
  auditMediaAssets,
  deleteMediaAssetsByType,
  mediaAssetTypeToBucketFolder,
};
