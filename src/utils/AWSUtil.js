const {
  OPERATIONAL_BUCKET,
  AWS_ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY,
  AWS_PRESIGN_EXPIRE_SECONDS,
} = process.env;
const stream = require('stream');
const aws = require('aws-sdk');

const s3 = new aws.S3({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  Bucket: process.env.OPERATIONAL_BUCKET,
});

const getPresignedUrl = (
  s3key,
  bucketFolder = 'media',
  bucket = OPERATIONAL_BUCKET
) => {
  const presignedUrlParams = {
    Bucket: bucket,
    Key: bucketFolder ? `${bucketFolder}/${s3key}` : s3key,
    Expires: parseInt(
      AWS_PRESIGN_EXPIRE_SECONDS ? AWS_PRESIGN_EXPIRE_SECONDS : 86400
    ),
  };
  const presignedUrlResult = s3.getSignedUrlPromise(
    'getObject',
    presignedUrlParams
  );
  if (presignedUrlResult.err) throw presignedUrlResult.err;
  return presignedUrlResult;
};

const emptyS3Bucket = async Bucket => {
  try {
    const { Contents } = await s3.listObjects({ Bucket }).promise();
    if (Contents.length > 0) {
      return await s3
        .deleteObjects({
          Bucket,
          Delete: {
            Objects: Contents.map(({ Key }) => ({ Key })),
          },
        })
        .promise();
    }
  } catch (err) {
    console.error(err);
  }
};

function listObjects(bucket, dir) {
  const listParams = {
    Bucket: bucket,
    Prefix: dir,
  };

  return s3.listObjectsV2(listParams).promise();

}

async function listAllObjects(bucket, dir) {
  const allObjects = [];
  let response;
  do {
    response = await listObjects(bucket, dir);
    allObjects.push(...response.Contents);
  } while (response.IsTruncated);
  return allObjects;
}

async function emptyS3Directory(bucket, dir) {
  const listedObjects = await listAllObjects(bucket, dir);

  // If no objects just return don't throw error
  if (listedObjects.length === 0) {
    return;
  }

  const deleteParams = {
    Bucket: bucket,
    Delete: { Objects: [] },
  };

  listedObjects.forEach(({ Key }) => {
    deleteParams.Delete.Objects.push({ Key });
  });

  await s3.deleteObjects(deleteParams).promise();

  if (listedObjects.IsTruncated) await emptyS3Directory(bucket, dir);
}

async function s3DeleteObjectPromise(bucket, key, mediaPrefix = 'media') {
  return s3
    .deleteObject({
      Bucket: bucket,
      Key: `${mediaPrefix}/${key}`,
    })
    .promise();
}

async function renameS3Files(req, res) {
  const s3Params = {
    Bucket: process.env.MEDIA_ASSET_SOURCE_BUCKET,
    Prefix: 'QUESTION_AUDIO/',
  };

  try {
    const listedObjects = await s3.listObjectsV2(s3Params).promise();

    // If no content in bucket return 400
    if (listedObjects.Contents.length === 0) {
      return res.status(400).send({ message: 'No content in bucket' });
    }

    // Map through objects
    listedObjects.Contents.map(async object => {
      // Find files that include .mp3
      if (object.Key.includes('.mp3')) {
        const modifiedKey = object.Key.split('.').shift();

        // Set new file params
        const params = {
          Bucket: process.env.MEDIA_ASSET_SOURCE_BUCKET,
          CopySource: process.env.MEDIA_ASSET_SOURCE_BUCKET + '/' + object.Key,
          Key: modifiedKey,
        };

        // Set delete params to delete old file once copy completed
        const deleteParams = {
          Bucket: process.env.MEDIA_ASSET_SOURCE_BUCKET,
          Key: object.Key,
        };

        console.log('Copying: ' + object.Key + ' to new file: ' + modifiedKey);
        // Copy file
        s3.copyObject(params, async function (err) {
          if (err) {
            return console.log('s3 rename error', err.stack);
          } else {
            // Once file copied and no errors delete old file
            console.log('Deleting old file: ' + object.Key);
            await s3.deleteObject(deleteParams).promise();
          }
        });
      } else {
        return;
      }
    });

    return res.status(200).send({ message: 'File rename complete' });
  } catch (error) {
    console.log('Error trying to rename s3 files: ' + error);
    return res.status(500).send({ message: 'Error renaming files' });
  }
}

const s3GetObjectReadStream = (bucket, key, mediaPrefix = 'media') => {
  if (mediaPrefix === 'none')
    return s3
      .getObject({ Bucket: bucket, Key: key })
      .createReadStream()
      .on('error', function (err) {
        // Handle errors
        console.error(err);
      });
  else
    return s3
      .getObject({ Bucket: bucket, Key: `${mediaPrefix}/${key}` })
      .createReadStream()
      .on('error', function (err) {
        // Handle errors
        console.error(err);
      });
};

const s3GetObjectPromise = (bucket, key) => {
  return s3.getObject({ Bucket: bucket, Key: `${key}` }).promise();
};

const s3CopyObjectPromise = (targetBucket, key, copySource) => {
  return s3
    .copyObject({ Bucket: targetBucket, Key: `${key}`, CopySource: copySource })
    .promise();
};

const s3UploadStreamPromise = (
  bucket,
  key,
  mediaPrefix = 'media',
  contentType = 'audio/mpeg'
) => {
  const pass = new stream.PassThrough();
  return {
    s3WriteStream: pass,
    s3WritePromise: s3
      .upload({
        Bucket: bucket,
        Key: `${mediaPrefix}/${key}`,
        Body: pass,
        ContentType: contentType,
      })
      .promise(),
  };
};

const s3UploadPromise = (
  bucket,
  key,
  body,
  mediaPrefix = 'media',
  contentType = 'audio/mpeg'
) => {
  return s3
    .upload({
      Bucket: bucket,
      Key: `${mediaPrefix}/${key}`,
      Body: body,
      ContentType: contentType,
    })
    .promise();
};

const objectExistsInS3Bucket = async (Bucket, Key) => {
  const params = {
    Bucket,
    Key,
  };
  try {
    await s3.headObject(params).promise();
    return true;
  } catch (err) {
    return false;
  }
};

module.exports = {
  getPresignedUrl,
  emptyS3Directory,
  renameS3Files,
  s3GetObjectReadStream,
  s3GetObjectPromise,
  s3CopyObjectPromise,
  s3UploadStreamPromise,
  s3UploadPromise,
  s3DeleteObjectPromise,
  emptyS3Bucket,
  objectExistsInS3Bucket,
  listObjects,
  listAllObjects
};
