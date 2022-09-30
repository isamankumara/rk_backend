import { getQuestionBundleAudioFileLocation } from '../../../utils/ContentUtil';
import {
  ContentTypes,
  PlayableItemTypes,
  MediaAssetTypes,
  Question,
} from '../../../ts/types/contentTypes';
import { Result } from '../../../ts/types/resultTypes';
import { objectExistsInS3Bucket } from '../../../utils/AWSUtil';
import { fields as UserFields } from '../../../lists/UserSchema';
import { fields as TopicFields } from '../../../lists/TopicSchema';
import { fields as ThemeFields } from '../../../lists/ThemeSchema';
import { fields as TagFields } from '../../../lists/TagSchema';
import { fields as QuestionFields } from '../../../lists/QuestionSchema';
import { fields as PlayableItemFields } from '../../../lists/PlayableItemSchema';

export const getMandatoryFields = contentType => {
  let allFields;
  switch (contentType) {
    case ContentTypes.User:
      allFields = UserFields;
      break;
    case ContentTypes.Topic:
      allFields = TopicFields;
      break;
    case ContentTypes.Theme:
      allFields = ThemeFields;
      break;
    case ContentTypes.Tag:
      allFields = TagFields;
      break;
    case ContentTypes.Question:
      allFields = QuestionFields;
      break;
    case ContentTypes.PlayableItem:
      allFields = PlayableItemFields;
      break;
  }
  const allFieldsEntries = Object.entries(allFields);
  const mandatoryFields = [];
  for (const [key, value] of allFieldsEntries)
    if (value['isRequired'] === true) mandatoryFields.push(key);
  return mandatoryFields;
};

export const mandatoryFieldsCheck = (contentType, objects): Result => {
  const mandatoryFields = getMandatoryFields(contentType);
  for (const object of objects) {
    for (const field of mandatoryFields)
      if (!object[field])
        return {
          error: true,
          message: `mandatoryFields check failed for content type ${contentType} object ${objectToString(
            object
          )}`,
        };
  }
  return {
    error: false,
  };
};

export const relationshipLookupCheck = (
  contentType,
  contentRows,
  identProp,
  foreignRows,
  foreignIdentProp = identProp
): Result => {
  for (const row of contentRows) {
    const referredObjectList = row[identProp];
    const referredObjectKeys = referredObjectList.split(',');
    for (const referredObjectKey of referredObjectKeys) {
      const matchingForeignRows = foreignRows.filter(
        foreignRow => foreignRow[foreignIdentProp] === referredObjectKey
      );
      if (matchingForeignRows.length === 0)
        return {
          error: true,
          message: `relationship lookup check failed for content type ${contentType} row ${objectToString(
            row
          )}`,
        };
    }
  }
  return {
    error: false,
  };
};

export const mediaAssetSourceFileLookupCheck = async (
  contentType,
  contentRows,
  mediaAssetIdentProp,
  mediaAssetType
): Promise<Result> => {
  for (const row of contentRows) {
    const referredMediaAssetKey = row[mediaAssetIdentProp];
    if (!referredMediaAssetKey) continue;

    // ALL-443 until we align pi types with media asset types, we have to do this...
    let resolvedMediaAssetType;

    if (
      contentType === ContentTypes.PlayableItem &&
      mediaAssetIdentProp === 'itemIdentifier'
    ) {
      if (row['type'] === PlayableItemTypes.AUDIO)
        resolvedMediaAssetType = MediaAssetTypes.PLAYABLE_AUDIO;
      else if (row['type'] === PlayableItemTypes.VIDEO)
        resolvedMediaAssetType = MediaAssetTypes.PLAYABLE_VIDEO;
      else
        return {
          error: true,
          message: `media asset source file lookup check failed for content type ${contentType} row ${objectToString(
            row
          )} referredMediaAssetKey ${referredMediaAssetKey}`,
        };
    } else resolvedMediaAssetType = mediaAssetType;

    const mediaAssetSourceFileExists = await objectExistsInS3Bucket(
      process.env.MEDIA_ASSET_SOURCE_BUCKET,
      `${resolvedMediaAssetType}/${referredMediaAssetKey}`
    );
    if (!mediaAssetSourceFileExists)
      return {
        error: true,
        message: `media asset source file lookup check failed for content type ${contentType} row ${objectToString(
          row
        )} referredMediaAssetKey ${referredMediaAssetKey}`,
      };
  }
  return {
    error: false,
  };
};

export const questionAudioFileLookupCheck = async (
  contentRows
): Promise<Result> => {
  for (const row of contentRows) {
    const results: Array<Result> = await Promise.all(
      Question.sampleRates.map(async sampleRate => {
        const questionIdentifier = row['identifier'];
        const audioFileLocation = getQuestionBundleAudioFileLocation(
          questionIdentifier,
          sampleRate
        );
        const audioFileExists = await objectExistsInS3Bucket(
          process.env.QUESTION_BUNDLES_BUCKET,
          audioFileLocation
        );
        if (!audioFileExists)
          return {
            error: true,
            message: `question audio source file lookup check failed for sample rate ${sampleRate} question row ${objectToString(
              row
            )}`,
          };
        return {
          error: false,
        };
      })
    );
    for (const result of results) {
      if (result.error) return result;
    }
    return {
      error: false,
    };
  }
};
const objectToString = obj => {
  return Object.entries(obj).reduce((string, [key, value]) => {
    return `${string}\n${key}: ${value}\n`;
  }, '');
};
