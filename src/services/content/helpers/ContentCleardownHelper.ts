import {
  ContentTypes,
  TopicMetadataQuestionType,
} from '../../../ts/types/contentTypes';
import { getItems, deleteItems } from '../../../controllers/GQL';
import {
  s3DeleteObjectPromise,
  objectExistsInS3Bucket,
} from '../../../utils/AWSUtil';
const { OPERATIONAL_BUCKET } = process.env;

export const defaultCleardowns = [
  ContentTypes.PlayableItem,
  ContentTypes.Tag,
  ContentTypes.Topic,
  ContentTypes.Theme,
  ContentTypes.Question,
  ContentTypes.Story,
  ContentTypes.User,
];

export const cleardownContentType = async (
  contentType: string,
  orgIdent: string
) => {
  switch (contentType) {
    case ContentTypes.Tag:
    case ContentTypes.Theme:
    case ContentTypes.User:
      await cleardownContentItems(
        contentType,
        {
          organisation: {
            identifier: orgIdent,
          },
        },
        `id`
      );
      break;
    case ContentTypes.Question:
      // clear down questions and branches separately
      // so that media assets can be correctly handled
      await cleardownContentItems(
        contentType,
        {
          organisation: {
            identifier: orgIdent,
          },
          type: TopicMetadataQuestionType.QUESTION,
        },
        `id
        audioFileLow {
          id
          s3key
        }
        audioFileHigh {
          id
          s3key
        }`,
        ['audioFileLow', 'audioFileHigh']
      );
      await cleardownContentItems(
        contentType,
        {
          organisation: {
            identifier: orgIdent,
          },
          type: TopicMetadataQuestionType.BRANCH,
        },
        `id`
      );
      break;
    case ContentTypes.PlayableItem:
      await cleardownContentItems(
        contentType,
        {
          organisation: {
            identifier: orgIdent,
          },
        },
        `id
        item {
          id
          s3key
        }
        previewImage {
          id
          s3key
        }`,
        ['item', 'previewImage']
      );
      break;
    case ContentTypes.Story:
      await cleardownContentItems(
        contentType,
        {
          interviewer: {
            organisation: {
              identifier: orgIdent,
            },
          },
        },
        `id
        audioFile {
          id
          s3key
        }`,
        ['audioFile']
      );
      break;
    case ContentTypes.Theme:
      await cleardownContentItems(
        contentType,
        {
          organisation: {
            identifier: orgIdent,
          },
        },
        `id
        previewImage {
          id
          s3key
        }`,
        ['previewImage']
      );
      break;
    case ContentTypes.Topic:
      await cleardownContentItems(
        contentType,
        {
          theme: {
            organisation: {
              identifier: orgIdent,
            },
          },
        },
        `id`
      );
      break;
  }
};

const cleardownContentItems = async (
  contentType: string,
  whereClause,
  deleteFragment: string,
  mediaAssetProps: string[] = []
) => {
  const deleteObjs = await getItems(contentType, whereClause, deleteFragment);
  const deleteIds = dictionaryToArray(deleteObjs, 'id');
  await deleteItems(contentType, deleteIds);
  for (const mediaAssetProp of mediaAssetProps) {
    const deleteMediaAssets = deleteObjs.map(deleteObj => {
      return deleteObj[mediaAssetProp] ? deleteObj[mediaAssetProp] : null;
    });
    try {
      await clearDownMediaAssets(
        deleteMediaAssets.filter(item => item !== null)
      );
    } catch (err) {
      console.warn('clearDownMediaAssets', err);
    }
  }
};

const clearDownMediaAssets = async deleteMediaAssets => {
  await deleteItems('MediaAsset', dictionaryToArray(deleteMediaAssets, 'id'));
  await Promise.all(
    deleteMediaAssets.map(async deleteMediaAsset => {
      if (
        await objectExistsInS3Bucket(
          OPERATIONAL_BUCKET,
          `media/${deleteMediaAsset.s3key}`
        )
      )
        return s3DeleteObjectPromise(
          OPERATIONAL_BUCKET,
          deleteMediaAsset.s3key
        );
    })
  );
};

const dictionaryToArray = (objects, key: string) => {
  const array = objects.map(o => {
    return o[key];
  });

  // remove potential duplicates
  const uniqueSet = new Set<string>(array);
  return [...uniqueSet];
};
