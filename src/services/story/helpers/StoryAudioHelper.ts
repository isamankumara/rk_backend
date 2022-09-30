import { getItem, getItems } from '../../../controllers/GQL';
import { getChannelHlsChunks } from '../../audiochannel/helpers/StreamingHelper';
import { channelDownstreamUrl } from '../../../utils/AudioChannelUtil';
import { writeM3uManifest } from '../../../utils/HlsUtil';
import { Track, TrackType, HlsChunk } from '../../../ts/types/audioTypes';
import {
  Story,
  StoryStatus,
  MediaAsset,
  StoryMetadata,
  AudioChannel,
  MongoId,
  Question,
  AudioChannelSampleRate,
} from '../../../ts/types/contentTypes';

export const getMp3QuestionTrack = async (
  story: Story,
  qIdentifier: string,
  index: number
) => {
  const qDBs = await getItems(
    'Question',
    {
      identifier: qIdentifier,
    },
    `audioFileHigh {
    url
    duration
  }`
  );
  const qAudiofile: MediaAsset = qDBs[0].audioFileHigh;
  return new Track(
    `${story.id}.q${index}`,
    `${story.title} - q${index}`,
    qAudiofile.url,
    parseFloat(qAudiofile.duration),
    TrackType.Default,
    story.interviewer.username,
    story.interviewer.avatarImageMediaAsset
      ? story.interviewer.avatarImageMediaAsset.url
      : ''
  );
};
export const getMp3QuestionHlsChunk = async (
  qIdentifier: string,
  answerChannelId: MongoId
) => {
  const qDBsPromise = getItems(
    'Question',
    {
      identifier: qIdentifier,
    },
    `audioFileLow {
      url
      duration
    }
    audioFileHigh {
      url
      duration
    }`
  );
  const aChannelPromise = getItem(
    'AudioChannel',
    answerChannelId,
    `id
  sampleRate`
  );
  const dbResponses: Array<AudioChannel> = await Promise.all([
    qDBsPromise,
    aChannelPromise,
  ]);
  const question: Question = dbResponses[0][0];
  const channel: AudioChannel = dbResponses[1];
  const qAudiofile: MediaAsset = matchQuestionAudioFileToChannelSampleRate(
    question,
    channel.sampleRate
  );
  return {
    url: qAudiofile.url,
    duration: parseFloat(qAudiofile.duration),
  };
};
const matchQuestionAudioFileToChannelSampleRate = (
  question: Question,
  channelSampleRate: number
): MediaAsset => {
  switch (channelSampleRate) {
    case AudioChannelSampleRate.LOW:
      return question.audioFileLow;
    case AudioChannelSampleRate.HIGH:
      return question.audioFileHigh;
    default:
      throw `matchQuestionAudioFileToChannelSampleRate received invalid channelSampleRate ${channelSampleRate}`;
  }
};

export const getHlsAnswerTrack = async (
  story: Story,
  answerChannelId: string,
  answerDuration: number,
  index: number
) => {
  return new Track(
    `${story.id}.a${index}`,
    `${story.title} - a${index}`,
    channelDownstreamUrl(answerChannelId),
    answerDuration,
    TrackType.Hls,
    story.interviewer.username,
    story.interviewer.avatarImageMediaAsset
      ? story.interviewer.avatarImageMediaAsset.url
      : ''
  );
};

export const getHlsAnswerChunks = async (answerChannelId: string) => {
  return await getChannelHlsChunks(answerChannelId);
};

export async function getTracks(story: Story): Promise<Array<Track>> {
  if (story.status === StoryStatus.PUBLISHED_FINALISED) {
    if (story.audioFile)
      return [
        new Track(
          story.id,
          story.title,
          story.audioFile.url,
          parseFloat(story.duration),
          TrackType.Default,
          story.interviewer.username,
          story.interviewer.avatarImageMediaAsset
            ? story.interviewer.avatarImageMediaAsset.url
            : ''
        ),
      ];
    else
      console.warn(
        `getTracks unable to locate audiofile for ${story.status} story with id ${story.id}`
      );
    return [];
  } else if (story.status === StoryStatus.PUBLISHED) {
    return [
      new Track(
        story.id,
        story.title,
        storyDownstreamUrl(story.id),
        parseFloat(story.duration),
        TrackType.Hls,
        story.interviewer.username,
        story.interviewer.avatarImageMediaAsset
          ? story.interviewer.avatarImageMediaAsset.url
          : ''
      ),
    ];
  } else {
    console.warn(
      `getTracks unable to supply tracks for  ${story.status} story with id ${story.id}`
    );
    return [];
  }
}

export async function sendStoryHlsManifest(story: Story, writeStream) {
  // for now just assume story is published but not finalised
  const metadata: StoryMetadata = JSON.parse(story.metadata);
  const rawSequence: HlsChunk[][] = await Promise.all(
    metadata.responses.map(async response => {
      if (response.channelId && !response.isChannelEmpty) {
        return [
          await getMp3QuestionHlsChunk(response.identifier, response.channelId),
          ...(await getHlsAnswerChunks(response.channelId)),
        ];
      } else return null;
    })
  );
  const storyHlsChunks: HlsChunk[] = rawSequence.reduce(
    (hlsChunks: HlsChunk[], item) => {
      if (item) {
        hlsChunks.push(...item);
      }
      return hlsChunks;
    },
    []
  );
  writeM3uManifest(storyHlsChunks, writeStream);
}

export const storyDownstreamUrl = (storyId: MongoId): string => {
  return `${process.env.VERSION_BASE_ROUTE}/story/${storyId}/hls`;
};
