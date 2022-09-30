const aws = require('aws-sdk');
const multerS3 = require('multer-s3');
const multer = require('multer');
const { createItem } = require('./GQL');

const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  Bucket: process.env.OPERATIONAL_BUCKET,
});

// The req are needed.
const imageUpload = multer({
  storage: multerS3({
    s3: s3,
    acl: 'public-read',
    bucket: process.env.OPERATIONAL_BUCKET,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: async function (req, file, cb) {
      const newMediaAsset = await createItem(
        'MediaAsset',
        {
          title: file.originalname,
          type: 'USER_PROFILE_IMAGE',
        },
        's3key'
      );
      // cb(null, path.basename(file.originalname, path.extname(file.originalname)) + '-' + Date.now() + path.extname(file.originalname))
      // place in the media folder named for the media asset s3key
      // TODO: set metadata for the uploaded image
      cb(null, `media/${newMediaAsset.s3key}`);
    },
  }),
});

module.exports = { imageUpload };
