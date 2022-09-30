import { testUserFields } from './data/testData';
import {
  Story,
  Topic,
  Interviewer,
  StoryStatus,
  Question,
  MediaAsset,
  MediaAssetTypes,
  IDBItem,
  StoryMetadata,
} from '../src/ts/types/contentTypes';
import { JSONObject } from '../src/ts/types/objectTypes';

import {
  testStoryId,
  testTopicId,
  testInterviewerId,
  recordingChannelIds,
  questionIds,
  mediaAssetIds,
  testUrl,
  testTopicMetadata,
  testOrganisations,
} from './unitTestData';

export const defaultTopic = new Topic(
  testTopicId,
  'Test topic',
  testTopicMetadata
);
const defaultInterviewer = new Interviewer(
  testInterviewerId,
  testUserFields.username
);
export const defaultMediaAsset = new MediaAsset(
  '60f6ce6ab5eb540015ee19ea',
  MediaAssetTypes.QUESTION_AUDIO,
  'Default media asset',
  testUrl
);

export function createStory(title, interviewer = defaultInterviewer) {
  const story = new Story(testStoryId, title, defaultTopic);
  story.interviewer = interviewer;
  const metadata = {
    responses: JSON.parse(defaultTopic.metadata),
  };
  story.metadata = JSON.stringify(metadata);
  return story;
}

export function editStory(
  story: Story,
  qIdentifiers: Array<string> = ['SHQ1']
): Array<string> {
  const metadata: StoryMetadata = story.getMetadata();
  const responses: Array<JSONObject> = metadata.responses;
  const channelIds = [];
  for (const qIdent of qIdentifiers) {
    const filteredResponses = responses.filter(
      response => qIdent === response.identifier
    );
    if (filteredResponses.length === 1) {
      const thisResponse = filteredResponses[0];
      thisResponse.channelId = recordingChannelIds[qIdent];
      thisResponse.isChannelEmpty = false;
      thisResponse.answerDuration = 1;
      channelIds.push(recordingChannelIds[qIdent]);
    }
  }
  story.metadata = JSON.stringify(metadata);
  return channelIds;
}

export function publishStory(story: Story) {
  story.status = StoryStatus.PUBLISHED;
}

export async function getItems(
  listName,
  whereClause,
  // eslint-disable-next-line
  returnFragment
): Promise<Array<IDBItem>> {
  const { identifier } = whereClause;
  switch (listName) {
    case 'Organisation':
      return testOrganisations.filter(org => {
        return org.identifier === identifier;
      });
    case 'Question':
    default:
      const mediaAsset = new MediaAsset(
        mediaAssetIds[identifier],
        MediaAssetTypes.QUESTION_AUDIO,
        identifier,
        testUrl
      );
      const question = new Question(
        questionIds[identifier],
        identifier,
        identifier
      );
      question.audioFileHigh = mediaAsset;
      question.audioFileLow = mediaAsset;
      return [question];
  }
}
