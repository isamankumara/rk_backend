import {
  ContentTypes,
  MediaAssetTypes,
  MediaAsset,
  Question,
  MongoId,
  Organisation,
} from '../../../ts/types/contentTypes';
import {
  createItems,
  getItems,
  createItem,
  updateItem,
} from '../../../controllers/GQL';
import AWS from 'aws-sdk';
import { getQuestionBundleAudioFileLocation } from '../../../utils/ContentUtil';
import { s3GetObjectPromise } from '../../../utils/AWSUtil';
import mp3Duration from 'mp3-duration';
const {
  OPERATIONAL_BUCKET,
  QUESTION_BUNDLES_BUCKET,
  AWS_ACCESS_KEY,
  AWS_SECRET_ACCESS_KEY,
  MEDIA_ASSET_SOURCE_BUCKET,
  GOOGLE_CLIENT_EMAIL,
  CONTENT_SYNC_SPREADSHEET_IDENTIFIERS,
  CONTENT_SYNC_TABS,
} = process.env;

const s3 = new AWS.S3({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

const orgSheetIdentifiers = JSON.parse(CONTENT_SYNC_SPREADSHEET_IDENTIFIERS);

import { GoogleSpreadsheet } from 'google-spreadsheet';

let doc;

export const defaultSyncs = [
  ContentTypes.Tag,
  ContentTypes.Theme,
  ContentTypes.Topic,
  ContentTypes.User,
  ContentTypes.PlayableItem,
  ContentTypes.Question,
];

export const loadOrgSpreadsheet = async orgIdentifier => {
  doc = new GoogleSpreadsheet(orgSheetIdentifiers[orgIdentifier]);

  // use service account creds
  await doc.useServiceAccountAuth({
    client_email: GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });

  await doc.loadInfo(); // loads document properties and worksheets
};

export const getContentFromSpreadsheet = async contentTabIdentifier => {
  try {
    await doc.loadInfo(); // loads document properties and worksheets
    const tabIds = JSON.parse(CONTENT_SYNC_TABS);
    if (!tabIds.hasOwnProperty(contentTabIdentifier))
      throw `getContentRows invoked with invalid tab identifier ${contentTabIdentifier}`;

    const sheet = doc.sheetsById[tabIds[contentTabIdentifier]];
    const rows = await sheet.getRows();

    return contentRowsToObjects(rows);
  } catch (err) {
    console.error('getContentRows ', err);
  }
};

// uses the spreadsheet header text to translate each row array into an object representation
const contentRowsToObjects = rows => {
  const rowObjs = rows.map(row => {
    return row._rawData.reduce((rowObj, rowCol, i) => {
      rowObj[row._sheet.headerValues[i]] = rowCol;
      return rowObj;
    }, {});
  });
  return rowObjs;
};

export const synchroniseToTargetSchema = async (
  sourceItems,
  targetSchema,
  identProp
) => {
  const dbItems = await getItems(
    targetSchema,
    {},
    `id
    ${identProp}`
  );
  const creates = [];
  for (const sourceItem of sourceItems) {
    const matchingItems = dbItems.filter(dbItem => {
      return dbItem[identProp] === sourceItem[identProp];
    });

    if (matchingItems.length === 0) creates.push(sourceItem);
    else await updateItem(targetSchema, matchingItems[0].id, sourceItem);
  }
  if (creates.length > 0)
    await createItems(targetSchema, interleaveWithData(creates), 'id');
};

export const interleaveWithData = objects => {
  return objects.map(o => {
    return {
      data: o,
    };
  });
};

const getTagsConnectObject = async (tags, context) => {
  const tagsArray = tags.split(',');
  const mappedTagsArray = await Promise.all(
    tagsArray.map(async tagTitle => {
      const tagObjects = await getItems(
        'Tag',
        { title: tagTitle.trim(), context },
        'id'
      );
      const tagObject = tagObjects[0];
      return { id: tagObject.id };
    })
  );
  return {
    connect: mappedTagsArray,
  };
};

// We need to associate 2 audio files with the question, one for both quality settings LOW, HIGH
// Question audio files are sourced from the question bundles bucket
export const synchroniseQuestionMediaAssets = async (question: Question) => {
  const mediaAssetIds: MongoId[] = await Promise.all(
    Question.sampleRates.map(async sampleRate => {
      const qualifiedQuestionIdentifier = Question.qualifyMediaAssetIdentifier(
        question.identifier,
        sampleRate
      );

      const audioFileLocation = getQuestionBundleAudioFileLocation(
        question.identifier,
        sampleRate
      );
      const audioFileCopySource = `${QUESTION_BUNDLES_BUCKET}/${audioFileLocation}`;

      // derive duration from source file -- needed for overall story duration calculation
      const file = await s3GetObjectPromise(
        QUESTION_BUNDLES_BUCKET,
        `${audioFileLocation}`
      );
      const duration = (await mp3Duration(file.Body)).toString();

      const mediaAsset = await getOrCreateMediaAsset(
        qualifiedQuestionIdentifier,
        MediaAssetTypes.QUESTION_AUDIO,
        duration
      );

      try {
        await copyMediaAssetFileToOperationalBucket(
          audioFileCopySource,
          `media/${mediaAsset.s3key}`
        );
      } catch (err) {
        console.error(
          `synchroniseQuestionMediaAssets unable to copy source file ${qualifiedQuestionIdentifier}`
        );
      }
      return mediaAsset.id;
    })
  );
  return mediaAssetIds;
};

export const synchroniseMediaAsset = async (
  identifier: string,
  type: string
) => {
  const mediaAsset = await getOrCreateMediaAsset(identifier, type);

  try {
    await copyMediaAssetFileToOperationalBucket(
      `${MEDIA_ASSET_SOURCE_BUCKET}/${type}/${identifier}`,
      `media/${mediaAsset.s3key}`
    );
  } catch (err) {
    console.error(
      `synchroniseMediaAsset unable to copy source file ${identifier}`
    );
  } finally {
    return mediaAsset.id;
  }
};

export const copyMediaAssetFileToOperationalBucket = (
  copySource: string,
  key: string
) => {
  return s3
    .copyObject({
      CopySource: copySource,
      Bucket: OPERATIONAL_BUCKET,
      Key: key,
    })
    .promise();
};

export const getOrCreateMediaAsset = async (
  identifier: string,
  type: string,
  duration = ''
) => {
  // does a db record for this asset already exist?
  const matchingAssets = await getItems(
    'MediaAsset',
    {
      identifier,
      type,
    },
    `id`
  );

  let mediaAsset: MediaAsset;

  if (matchingAssets.length > 0) {
    const matchingAsset = matchingAssets[0];
    mediaAsset = await updateItem(
      'MediaAsset',
      matchingAsset.id,
      {
        duration,
      },
      `id
        s3key`
    );
  } else
    mediaAsset = await createItem(
      'MediaAsset',
      {
        identifier,
        type,
        duration,
      },
      `id
      s3key`
    );

  return mediaAsset;
};

export const prepPlayableItem = async playableItem => {
  const {
    order,
    type,
    itemIdentifier,
    previewImageIdentifier,
    tags,
  } = playableItem;

  await connectOrganisation(playableItem);

  const itemMediaAssetType = `PLAYABLE_${type}`;

  const mediaAssetItemId = await synchroniseMediaAsset(
    itemIdentifier,
    itemMediaAssetType
  );
  const mediaAssetPreviewImageId = await synchroniseMediaAsset(
    previewImageIdentifier,
    MediaAssetTypes.PLAYABLE_ITEM_PREVIEW_IMAGE
  );

  delete playableItem.itemIdentifier;
  delete playableItem.previewImageIdentifier;

  const connectTags = await getTagsConnectObject(tags, 'INTERNAL');
  playableItem.item = mediaAssetItemId
    ? {
        connect: {
          id: mediaAssetItemId,
        },
      }
    : null;
  playableItem.previewImage = mediaAssetPreviewImageId
    ? {
        connect: {
          id: mediaAssetPreviewImageId,
        },
      }
    : null;
  (playableItem.order = parseInt(order)), // this is necessary because Google sheets supplies this as a string
    (playableItem.tags = connectTags);
};

export const prepTheme = async theme => {
  const { previewImageIdentifier } = theme;

  await connectOrganisation(theme);

  if (previewImageIdentifier) {
    const mediaAssetPreviewImageId = await synchroniseMediaAsset(
      previewImageIdentifier,
      MediaAssetTypes.THEME_PREVIEW_IMAGE
    );

    delete theme.previewImageIdentifier;
    theme.previewImage = mediaAssetPreviewImageId
      ? {
          connect: {
            id: mediaAssetPreviewImageId,
          },
        }
      : null;
  }
};

export const prepTopic = async topic => {
  const themes = await getItems(
    'Theme',
    {
      identifier: topic.theme,
    },
    `id`
  );
  const themeId = themes[0].id;
  topic.theme = {
    connect: {
      id: themeId,
    },
  };
};

export const prepQuestion = async question => {
  await connectOrganisation(question);
  if (question.type === 'QUESTION') {
    const mediaAssetIds = await synchroniseQuestionMediaAssets(question);
    question.audioFileLow = {
      connect: {
        id: mediaAssetIds[0],
      },
    };
    question.audioFileHigh = {
      connect: {
        id: mediaAssetIds[1],
      },
    };
  }
};

export const connectOrganisation = async (
  contentItem
): Promise<Organisation> => {
  const organisations = await getItems(
    'Organisation',
    {
      identifier: contentItem.organisation,
    },
    `id
    identifier`
  );
  const organisation = organisations[0];
  contentItem.organisation = {
    connect: {
      id: organisation.id,
    },
  };
  return organisation;
};

export const initialiseOrganisations = async () => {
  const orgs = await getItems('Organisation', {}, 'id');
  if (orgs.length === 0) {
    const orgDictionary = JSON.parse(process.env.INITIALISE_ORGS);
    const creates = Object.entries(orgDictionary).map(([key, value]) => {
      return {
        identifier: key,
        name: value,
      };
    });
    await createItems('Organisation', interleaveWithData(creates), 'id');
  }
};
