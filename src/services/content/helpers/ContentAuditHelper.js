const moment = require('moment');
const { getItems } = require('../../../controllers/GQL');
const { listAllObjects } = require('../../../utils/AWSUtil');
const { OPERATIONAL_BUCKET } = process.env;

module.exports = {
  auditMediaAssetAgainstS3Media: async reportStream => {
    reportStream.write('====================================');
    reportStream.write('Starting auditMediaAssetAgainstS3Media');
    reportStream.write(`Timestamp: ${moment().format()}`);

    // get all media assets and all s3 media files
    const allMediaAssets = await getItems(
      'MediaAsset',
      {},
      `id
      identifier
        type
        s3key`
    );

    const allMediaFiles = await listAllObjects(OPERATIONAL_BUCKET, 'media');
    const matchlessMediaAssets = [];
    for (const mediaAsset of allMediaAssets) {
      const matchingFiles = allMediaFiles.filter(
        file => file.Key === `media/${mediaAsset.s3key}`
      );
      if (matchingFiles.length === 0) matchlessMediaAssets.push(mediaAsset);
    }
    reportStream.write(
      `Found ${matchlessMediaAssets.length} media assets in db without a matching media file in operational bucket media folder`
    );
    if (matchlessMediaAssets.length > 0) {
      reportStream.write('Details:');
      for (const mediaAsset of matchlessMediaAssets) {
        reportStream.write(`{`);
        reportStream.write(`mediaAsset.id ${mediaAsset.id}`);
        reportStream.write(`mediaAsset.identifier ${mediaAsset.identifier}`);
        reportStream.write(`mediaAsset.type ${mediaAsset.type}`);
        reportStream.write(`mediaAsset.s3key ${mediaAsset.type}`);
        reportStream.write(`}`);
      }
    }

    const matchlessMediaFiles = [];
    for (const mediaFile of allMediaFiles) {
      const matchingAssets = allMediaAssets.filter(
        asset => `media/${asset.s3key}` === mediaFile.Key
      );
      if (matchingAssets.length === 0) matchlessMediaFiles.push(mediaAsset);
    }
    reportStream.write(
      `Found ${matchlessMediaFiles.length} media files in in operational bucket media folder without a matching media asset record in db`
    );
    if (matchlessMediaFiles.length > 0) {
      reportStream.write('Details:');
      for (const mediaFile of matchlessMediaFiles) {
        reportStream.write(`{`);
        reportStream.write(`mediaFile.Key ${mediaFile.Key}`);
        reportStream.write(`}`);
      }
    }
    
    reportStream.write('Ending auditMediaAssetAgainstS3Media');
    reportStream.write('====================================');
  },
  auditFinalisedStoryMediaAssets: async reportStream => {
    reportStream.write('====================================');
    reportStream.write('Starting auditFinalisedStoryMediaAssets');
    reportStream.write(`Timestamp: ${moment().format()}`);

    // get all finalised stories
    const allFinalisedStories = await getItems(
      'Story',
      {
        status: 'PUBLISHED_FINALISED'
      },
      `id
      title
      updatedAt
      audioFile {
        id
        type
        s3key
      }`
    );

    const allMediaFiles = await listAllObjects(OPERATIONAL_BUCKET, 'media');

    // for each story do 2 checks
    // 1) does it have an audiofile?
    // 2) does the corresponding file exist?
    const storiesMissingAudiofiles = [];
    const storiesMissingMediafileOnS3 = [];

    for (const story of allFinalisedStories) {
      if (!story.audioFile) storiesMissingAudiofiles.push(story);
      else {
        const matchingMediaFiles = allMediaFiles.filter(mediaFile => mediaFile.Key === `media/${story.audioFile.s3key}`);
        if (matchingMediaFiles.length === 0) storiesMissingMediafileOnS3.push(story);
      }
    }

    reportStream.write(
      `Found ${storiesMissingAudiofiles.length} finalised stories without an audio file definition in db`
    );
    if (storiesMissingAudiofiles.length > 0) {
      reportStream.write('Details:');
      for (const story of storiesMissingAudiofiles) {
        reportStream.write(`{`);
        reportStream.write(`story.id ${story.id}`);
        reportStream.write(`story.title ${story.title}`);
        reportStream.write(`story.updatedAt ${story.updatedAt}`);
        reportStream.write(`}`);
      }
    }
    reportStream.write(
      `Found ${storiesMissingMediafileOnS3.length} finalised stories missing audio file in s3 operational bucket media folder`
    );
    if (storiesMissingMediafileOnS3.length > 0) {
      reportStream.write('Details:');
      for (const story of storiesMissingMediafileOnS3) {
        reportStream.write(`{`);
        reportStream.write(`story.id ${story.id}`);
        reportStream.write(`story.title ${story.title}`);
        reportStream.write(`story.updatedAt ${story.updatedAt}`);
        reportStream.write(`}`);
      }
    }
  },
  auditFinalisedAudioChannelMediaAssets: async reportStream => {
    reportStream.write('====================================');
    reportStream.write('Starting auditFinalisedAudioChannelMediaAssets');
    reportStream.write(`Timestamp: ${moment().format()}`);

    // get all finalised channels
    const allFinalisedChannels = await getItems(
      'AudioChannel',
      {
        status: 'PUBLISHED_FINALISED'
      },
      `id
      updatedAt
      story {
        id
      }
      audioFile {
        id
        type
        s3key
      }`
    );

    const allMediaFiles = await listAllObjects(OPERATIONAL_BUCKET, 'media');

    // for each channel do 2 checks
    // 1) does it have an audiofile?
    // 2) does the corresponding file exist?
    const channelsMissingAudiofiles = [];
    const channelsMissingMediafileOnS3 = [];

    for (const channel of allFinalisedChannels) {
      if (!channel.audioFile) channelsMissingAudiofiles.push(channel);
      else {
        const matchingMediaFiles = allMediaFiles.filter(mediaFile => mediaFile.Key === `media/${channel.audioFile.s3key}`);
        if (matchingMediaFiles.length === 0) channelsMissingMediafileOnS3.push(channel);
      }
    }

    reportStream.write(
      `Found ${channelsMissingAudiofiles.length} finalised channels without an audio file definition in db`
    );
    if (channelsMissingAudiofiles.length > 0) {
      reportStream.write('Details:');
      for (const channel of channelsMissingAudiofiles) {
        reportStream.write(`{`);
        reportStream.write(`channel.id ${channel.id}`);
        reportStream.write(`channel.story.id ${channel.story.id}`);
        reportStream.write(`channel.updatedAt ${channel.updatedAt}`);
        reportStream.write(`}`);
      }
    }
    reportStream.write(
      `Found ${channelsMissingMediafileOnS3.length} finalised channels missing audio file in s3 operational bucket media folder`
    );
    if (channelsMissingMediafileOnS3.length > 0) {
      reportStream.write('Details:');
      for (const channel of channelsMissingAudiofiles) {
        reportStream.write(`{`);
        reportStream.write(`channel.id ${channel.id}`);
        reportStream.write(`channel.story.id ${channel.story.id}`);
        reportStream.write(`channel.updatedAt ${channel.updatedAt}`);
        reportStream.write(`}`);
      }
    }
  },
};
