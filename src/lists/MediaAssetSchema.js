const { Text, File, Select, Virtual } = require('@keystonejs/fields');
const { S3Adapter } = require('@keystonejs/file-adapters');
const { getPresignedUrl } = require('../utils/AWSUtil');
const {
  OPERATIONAL_BUCKET,
  AWS_ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY,
} = process.env;
const S3_REGION = 'ap-southeast-2';

const fileAdapter = new S3Adapter({
  bucket: OPERATIONAL_BUCKET,
  folder: 'media',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  publicUrl: ({ filename }) =>
    `https://${OPERATIONAL_BUCKET}.s3.${S3_REGION}.amazonaws.com/media/${filename}`,
  s3Options: {
    // Optional paramaters to be supplied directly to AWS.S3 constructor
    apiVersion: '2006-03-01',
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    region: S3_REGION,
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  uploadParams: ({ id }) => ({
    Metadata: {
      keystone_id: `${id}`,
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getFilename: ({ id }) => {
    return id.toString();
  },
});

module.exports = {
  queryLimits: {
    maxResults: 1000,
  },
  fields: {
    type: {
      type: Select,
      options: [
        { value: 'USER_PROFILE_IMAGE', label: 'User profile image' },
        { value: 'STORY_RESPONSE_AUDIO', label: 'User story reponse audio' },
        { value: 'QUESTION_AUDIO', label: 'Question audio' },
        { value: 'COMPLETE_STORY_AUDIO', label: 'Complete story audio' },
        { value: 'PLAYABLE_VIDEO', label: 'Playable item video' },
        { value: 'PLAYABLE_AUDIO', label: 'PLAYABLE item audio' },
        {
          value: 'PLAYABLE_ITEM_PREVIEW_IMAGE',
          label: 'Playable item preview image',
        },
        { value: 'THEME_PREVIEW_IMAGE', label: 'Theme preview image' },
        { value: 'ORG_LOGO_IMAGE', label: 'Org logo image' },
      ],
      isRequired: true,
      defaultValue: 'QUESTION_AUDIO',
    },
    identifier: {
      type: Text,
      isRequired: true,
    },
    duration: {
      type: Text,
    },
    file: {
      type: File,
      adapter: fileAdapter,
    },
    s3key: {
      // S3 key
      // if a file has been uploaded, return the file object id
      // otherwise return the item id
      type: Virtual,
      resolver: item => {
        if (item.file) return `${item.file.id.toString()}`;
        else return `${item.id}`;
      },
    },
    url: {
      type: Virtual,
      resolver: async item => {
        let s3key;
        if (item.file) s3key = `${item.file.id.toString()}`;
        else s3key = `${item.id}`;
        const url = await getPresignedUrl(s3key);
        return url;
      },
    },
  },
};
