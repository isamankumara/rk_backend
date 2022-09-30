export enum ContentTypes {
  User = 'User',
  PlayableItem = 'PlayableItem',
  Tag = 'Tag',
  Theme = 'Theme',
  Question = 'Question',
  Topic = 'Topic',
  Story = 'Story',
}

export interface IDBItem {
  id: MongoId;
}

export class Tag implements IDBItem {
  id: MongoId;
  title: string;
}

export class Playlist implements IDBItem {
  id: MongoId;
  title: string;
  status: PlaylistStatus;
  isPublic: boolean;
  users: User[];
  stories: Story[];
  creator: User;
  constructor(
    id: string,
    title: string,
    status: PlaylistStatus,
    isPublic: boolean,
    creator: User
  ) {
    this.id = id;
    this.title = title;
    this.status = status;
    this.isPublic = isPublic;
    this.creator = creator;
  }
}

export enum PlaylistStatus {
  PUBLISHED = 'PUBLISHED',
  DELETED = 'DELETED',
}

export class Interviewer implements IDBItem {
  id: MongoId;
  username: string;
  avatarImageMediaAsset?: MediaAsset;
  organisation?: Organisation;
  constructor(id: string, username: string) {
    this.id = id;
    this.username = username;
  }
}

export class User extends Interviewer {
  bandwidthBenchmark?: string;
}

export type UserSignupFields = {
  firstName: string;
  lastName: string;
  emailAddress: string;
  username: string;
  mobileNumber: string;
  password: string;
  organisation?: MongoId;
  avatarImageMediaAsset?: {
    connect: {
      id: MongoId;
    };
  };
};

export class Organisation implements IDBItem {
  id: MongoId;
  identifier: string;
  constructor(id: string, identifier: string) {
    this.id = id;
    this.identifier = identifier;
  }
}

export enum MediaAssetTypes {
  USER_PROFILE_IMAGE = 'USER_PROFILE_IMAGE',
  STORY_RESPONSE_AUDIO = 'STORY_RESPONSE_AUDIO',
  QUESTION_AUDIO = 'QUESTION_AUDIO',
  COMPLETE_STORY_AUDIO = 'COMPLETE_STORY_AUDIO',
  PLAYABLE_VIDEO = 'PLAYABLE_VIDEO',
  PLAYABLE_AUDIO = 'PLAYABLE_AUDIO',
  PLAYABLE_ITEM_PREVIEW_IMAGE = 'PLAYABLE_ITEM_PREVIEW_IMAGE',
  THEME_PREVIEW_IMAGE = 'THEME_PREVIEW_IMAGE',
}

export enum PlayableItemTypes {
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
}

export class MediaAsset implements IDBItem {
  id: MongoId;
  type: MediaAssetTypes;
  identifier: string;
  url: string;
  duration: string;
  s3key: string;
  constructor(
    id: MongoId,
    type: MediaAssetTypes,
    identifier: string,
    url: string
  ) {
    this.id = id;
    this.type = type;
    this.s3key = id;
    this.identifier = identifier;
    this.url = url;
  }
}

export type MongoId = string;

export type MinimalTheme = {
  title: string;
  topics: Topic[];
};

export type ThemeStoriesContainer = { title: string; data: Story[] };

export class Topic implements IDBItem {
  id: MongoId;
  title: string;
  sequence: string;
  questionCount: number;
  duration: string;
  hasUserCompletedTopic: boolean;
  metadata: string;
  stories: Story[];
  constructor(
    id: MongoId,
    title: string,
    metadata = '',
    sequence = 'zzz',
    questionCount = 0,
    duration = '00:00',
    hasUserCompletedTopic = false
  ) {
    this.id = id;
    this.title = title;
    this.metadata = metadata;
    this.sequence = sequence;
    this.questionCount = questionCount;
    this.duration = duration;
    this.hasUserCompletedTopic = hasUserCompletedTopic;
  }
  getMetadata(): TopicMetadata {
    return JSON.parse(this.metadata);
  }
}

export enum AudioChannelSampleRate {
  UNSPECIFIED = -1,
  LOW = 16000,
  HIGH = 48000,
}

export class Question implements IDBItem {
  static sampleRates = [
    AudioChannelSampleRate.LOW,
    AudioChannelSampleRate.HIGH,
  ];

  id: MongoId;
  identifier: string;
  title: string;
  audioFile: MediaAsset;
  audioFileLow: MediaAsset;
  audioFileHigh: MediaAsset;
  next?: string;
  type?: string;
  right?: string;
  left?: string;
  constructor(id: MongoId, identifier: string, title: string) {
    this.id = id;
    this.identifier = identifier;
    this.title = title;
  }

  public static qualifyMediaAssetIdentifier(
    identifier: string,
    channelSampleRate: AudioChannelSampleRate
  ): string {
    switch (channelSampleRate) {
      case AudioChannelSampleRate.LOW:
        return `${identifier}_LOW`;
      case AudioChannelSampleRate.HIGH:
        return `${identifier}_HIGH`;
      default:
        throw `qualifyMediaAssetIdentifier received invalid channelSampleRate ${channelSampleRate}`;
    }
  }
}

export enum TopicMetadataQuestionType {
  QUESTION = 'QUESTION',
  BRANCH = 'BRANCH',
}

export type TopicMetadataQuestion = {
  identifier: string;
  type: TopicMetadataQuestionType;
  next: string;
};

export enum AudioChannelStatus {
  RECORDING = 'RECORDING',
  SAVED = 'SAVED',
  PUBLISHED = 'PUBLISHED',
  PUBLISHED_FINALISED = 'PUBLISHED_FINALISED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export class AudioChannel implements IDBItem {
  id: MongoId;
  status: AudioChannelStatus;
  story: Story;
  duration: string;
  chunks: string;
  sampleRate: AudioChannelSampleRate;
  inputChannels: number;
  audioFile: MediaAsset;
  updatedAt?: string;
  constructor(
    id: MongoId,
    status: AudioChannelStatus = AudioChannelStatus.RECORDING,
    sampleRate = AudioChannelSampleRate.LOW,
    inputChannels = 1
  ) {
    this.id = id;
    this.status = status;
    this.sampleRate = sampleRate;
    this.inputChannels = inputChannels;
  }
}

export enum DeclutterArchivePolicy {
  DELETE = 'DELETE',
  ARCHIVE = 'ARCHIVE',
}

export enum StoryStatus {
  RECORDING = 'RECORDING',
  PUBLISHED = 'PUBLISHED',
  PUBLISHED_FINALISED = 'PUBLISHED_FINALISED',
  SAVED = 'SAVED',
  DELETED = 'DELETED',
}
export type TopicMetadata = Array<Question>;

export type StoryResponseType = {
  identifier: string;
  channelId: MongoId;
  isChannelEmpty: boolean;
};

export type StoryMetadata = {
  responses: Array<StoryResponseType>;
};

export class Story implements IDBItem {
  id: MongoId;
  title: string;
  status: StoryStatus;
  likes: number;
  duration: string;
  isPublic: boolean;
  metadata: string;
  interviewer: Interviewer;
  tags: Tag[];
  topic: {
    id: MongoId;
    title: string;
  };
  audioFile?: MediaAsset;
  audioChannels?: AudioChannel[];
  orgIdentifier?: string;
  updatedAt?: string;
  constructor(
    id: MongoId,
    title: string,
    topic: {
      id: MongoId;
      title: string;
    } = null,
    status: StoryStatus = StoryStatus.RECORDING,
    likes = 0,
    duration = '',
    isPublic = true,
    interviewer: Interviewer = null,
    tags: Tag[] = [],
    audioFile?: MediaAsset
  ) {
    this.id = id;
    this.title = title;
    this.status = status;
    this.likes = likes;
    this.duration = duration;
    this.isPublic = isPublic;
    this.interviewer = interviewer;
    this.tags = tags;
    this.topic = topic;
    this.audioFile = audioFile;
  }
  getMetadata(): StoryMetadata {
    return JSON.parse(this.metadata);
  }
}

export type PublishStoryData = {
  title: string;
  isPublic: boolean;
  selectedTags: MongoId[];
  storyTellers: MongoId[];
  duration: string;
  metadata: StoryMetadata;
};
