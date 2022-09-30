import { ContentTypes, MediaAssetTypes } from '../../ts/types/contentTypes';
import { Result } from '../../ts/types/resultTypes';
import {
  mandatoryFieldsCheck,
  relationshipLookupCheck,
  mediaAssetSourceFileLookupCheck,
  questionAudioFileLookupCheck,
} from './helpers/ContentPreflightHelper';
import {
  loadOrgSpreadsheet,
  getContentFromSpreadsheet,
  defaultSyncs,
  synchroniseToTargetSchema,
  prepPlayableItem,
  prepTheme,
  prepTopic,
  prepQuestion,
  connectOrganisation,
} from './helpers/ContentSyncHelper';
import {
  auditFinalisedAudioChannelMediaAssets,
  auditMediaAssetAgainstS3Media,
  auditFinalisedStoryMediaAssets,
} from './helpers/ContentAuditHelper';
import {
  cleardownContentType,
  defaultCleardowns,
} from './helpers/ContentCleardownHelper';

export const preflightContent = async (
  orgIdentifier: string,
  syncs = defaultSyncs
): Promise<void> => {
  await loadOrgSpreadsheet(orgIdentifier);
  for (const sync of syncs) {
    const preflightResult: Result = await preflightContentType(sync);
    if (preflightResult.error)
      throw `Preflight Content aborted on preflight error for sync type ${sync}\n${preflightResult.message}`;
  }
};

export const synchroniseContent = async (
  orgIdentifier: string,
  syncs = defaultSyncs,
  runPreflightChecks = false
) => {
  await loadOrgSpreadsheet(orgIdentifier);
  for (const sync of syncs) {
    if (runPreflightChecks) {
      const preflightResult: Result = await preflightContentType(sync);
      if (preflightResult.error)
        throw `Synchronise Content aborted on preflight error for sync type ${sync}\n${preflightResult.message}`;
    }
    await synchroniseContentType(sync);
  }
};

export const cleardownContent = async (
  orgIdent: string,
  cleardowns: string[] = defaultCleardowns
): Promise<void> => {
  for (const cleardown of cleardowns) {
    await cleardownContentType(cleardown, orgIdent);
  }
};

export const auditContent = async (reportStream): Promise<void> => {
  await auditMediaAssetAgainstS3Media(reportStream);
  await auditFinalisedStoryMediaAssets(reportStream);
  await auditFinalisedAudioChannelMediaAssets(reportStream);
};

const synchroniseContentType = async (contentType: string): Promise<void> => {
  let identProp = 'identifier';
  let prepContent;
  // adjust for content types which don't take the defaults
  switch (contentType) {
    case ContentTypes.Tag:
      identProp = 'title';
      prepContent = connectOrganisation;
      break;
    case ContentTypes.Theme:
      prepContent = prepTheme;
      break;
    case ContentTypes.Topic:
      prepContent = prepTopic;
      break;
    case ContentTypes.User:
      identProp = 'emailAddress';
      prepContent = connectOrganisation;
      break;
    case ContentTypes.PlayableItem:
      identProp = 'title';
      prepContent = prepPlayableItem;
      break;
    case ContentTypes.Question:
      prepContent = prepQuestion;
      break;
  }
  const contentRows = await getContentFromSpreadsheet(contentType);
  if (contentRows && contentRows.length > 0) {
    if (prepContent)
      await Promise.all(contentRows.map(async row => prepContent(row)));
    await synchroniseToTargetSchema(contentRows, contentType, identProp);
  }
};

const preflightContentType = async (contentType: string): Promise<Result> => {
  // check 1: mandatory fields
  const contentRows = await getContentFromSpreadsheet(contentType);

  // no error if we have no content
  if (contentRows.length === 0)
    return {
      error: false,
    };

  const mandatoryCheckResult: Result = mandatoryFieldsCheck(
    contentType,
    contentRows
  );
  if (mandatoryCheckResult.error) return mandatoryCheckResult;

  // check 2: relationship lookup
  let relationshipLookupCheckResult: Result = {
    error: false,
  };
  switch (contentType) {
    case ContentTypes.Topic:
      const themeRows = await getContentFromSpreadsheet(ContentTypes.Theme);
      relationshipLookupCheckResult = relationshipLookupCheck(
        contentType,
        contentRows,
        'theme',
        themeRows,
        'identifier'
      );
      break;
  }
  if (relationshipLookupCheckResult.error) return relationshipLookupCheckResult;

  // check 3: media asset source files check
  let mediaAssetSourceFileLookupResult: Result = {
    error: false,
  };
  switch (contentType) {
    case ContentTypes.Question:
      mediaAssetSourceFileLookupResult = await questionAudioFileLookupCheck(
        contentRows
      );
      break;
    case ContentTypes.Theme:
      mediaAssetSourceFileLookupResult = await mediaAssetSourceFileLookupCheck(
        contentType,
        contentRows,
        'previewImageIdentifier',
        MediaAssetTypes.THEME_PREVIEW_IMAGE
      );
      break;
    case ContentTypes.PlayableItem:
      mediaAssetSourceFileLookupResult = await mediaAssetSourceFileLookupCheck(
        contentType,
        contentRows,
        'itemIdentifier',
        '' // left blank because type is determined by the handler
      );
      if (mediaAssetSourceFileLookupResult.error)
        return mediaAssetSourceFileLookupResult;
      mediaAssetSourceFileLookupResult = await mediaAssetSourceFileLookupCheck(
        contentType,
        contentRows,
        'previewImageIdentifier',
        MediaAssetTypes.PLAYABLE_ITEM_PREVIEW_IMAGE
      );
      break;
  }
  if (mediaAssetSourceFileLookupResult.error)
    return mediaAssetSourceFileLookupResult;

  // end of checks, must be success if this point is reached
  return {
    error: false,
  };
};
