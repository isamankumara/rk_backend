const { createItem, getItem } = require('../controllers/GQL');
const fs = require('fs');
const AWS = require('aws-sdk');
const {
  OPERATIONAL_BUCKET,
  AWS_ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY,
} = process.env;
const s3 = new AWS.S3({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

module.exports = {
  registerAndUploadAvatarToS3: async avatarImage => {
    // upload to S3 and get media asset id
    // open file stream for the aiFile
    const newMediaAsset = await createItem(
      'MediaAsset',
      {
        identifier: avatarImage.originalname,
        type: 'USER_PROFILE_IMAGE',
      },
      's3key'
    );

    const avatarImageMediaAssetId = newMediaAsset.s3key;

    const fileReadResult = await fs.promises.readFile(avatarImage.path);
    if (fileReadResult.err) throw fileReadResult.err;

    const aiFileKey = `media/${avatarImageMediaAssetId}`;
    const { mimetype: mimeType } = avatarImage;

    // upload the file to AWS
    // TODO: add md5 header for data corruption checking
    const params = {
      Body: fileReadResult,
      Bucket: OPERATIONAL_BUCKET,
      Key: aiFileKey,
      ContentType: mimeType,
    };

    const s3Result = await s3.upload(params).promise();
    if (s3Result.err) throw s3Result.err;

    return avatarImageMediaAssetId;
  },
  getUserOrg: async userId => {
    const user = await getItem('User', 
      userId,
      `organisation {
        identifier
        name
        tasksBaseRoute
      }`);
    if (!user.organisation) throw `User ${userId} has no associated organisation`;
    return user.organisation;
  }
};
