import { TopicMetadata, Question } from '../../../ts/types/contentTypes';
import { getItems } from '../../../controllers/GQL';

export const packageTopicMetadata = async (
  metadataJSON: string,
  orgIdent: string
): Promise<TopicMetadata> => {
  const metadata: TopicMetadata = JSON.parse(metadataJSON);
  const packagedMetadata: TopicMetadata = await Promise.all(
    metadata.map(
      async (qObj: Question): Promise<Question> => {
        let question;
        if (qObj.type === 'QUESTION') {
          const items: Question[] = await getItems(
            'Question',
            {
              identifier: qObj.identifier,
              organisation: {
                identifier: orgIdent,
              },
            },
            `identifier
          type
          title
          audioFileHigh {
            s3key
            url
            duration
          }`
          );
          const questionRef = items[0];
          question = {
            identifier: questionRef.identifier,
            type: questionRef.type,
            title: questionRef.title,
            audioFile: {
              s3key: questionRef.audioFileHigh.s3key,
              url: questionRef.audioFileHigh.url,
              duration: questionRef.audioFileHigh.duration,
            },
          };
          question.next = qObj.next;
        } else {
          const items: Array<Question> = await getItems(
            'Question',
            {
              identifier: qObj.identifier,
              organisation: {
                identifier: orgIdent,
              },
            },
            `identifier
          type
          title
          rightPathLabel
          leftPathLabel`
          );
          const questionRef = items[0];
          question = {
            identifier: questionRef.identifier,
            type: questionRef.type,
            title: questionRef.title,
          };
          question.right = qObj.right;
          question.left = qObj.left;
        }
        return question;
      }
    )
  );
  return packagedMetadata;
};

export const rawQuestionCount = metadataJson => {
  if (!metadataJson) return -1;
  try {
    const topicMetadata = JSON.parse(metadataJson);
    return topicMetadata.length; // the anyconnect questions count
  } catch (err) {
    console.error(err);
    return 'Error';
  }
};
