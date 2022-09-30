import { MongoId } from './contentTypes';

export enum TrackType {
  Default = 'default',
  Hls = 'hls',
}
export enum TrackContentType {
  MP3 = 'mp3',
}

export class Track {
  id: string;
  title: string;
  url: string;
  duration: number;
  type: TrackType;
  artist?: string;
  artwork?: string;
  contentType: TrackContentType;

  constructor(
    id: string,
    title: string,
    url: string,
    duration = 0,
    type: TrackType = TrackType.Default,
    artist = '',
    artwork = ''
  ) {
    this.id = id;
    this.title = title;
    this.url = url;
    this.duration = duration;
    this.type = type;
    this.artist = artist;
    this.artwork = artwork;
    this.contentType = TrackContentType.MP3;
  }
}

export class AudioChunk {
  chunkId: string;
  duration: number;
  constructor(chunkId: string, duration: number) {
    this.chunkId = chunkId;
    this.duration = duration;
  }
}

export type HlsChunk = {
  url: string;
  duration: number;
};

export type AudioBuffer = {
  data: Buffer;
};

export class ChannelInfo {
  channelId: MongoId;
  storyId: MongoId;
  sampleRate: number;
  inputChannels: number;
  audioDuration: number;
  chunks: AudioChunk[];
  constructor(
    channelId: string,
    audioDuration = 0,
    chunks: AudioChunk[] = [],
    sampleRate = 30000,
    inputChannels = 1
  ) {
    this.channelId = channelId;
    this.audioDuration = audioDuration;
    this.chunks = chunks;
    this.sampleRate = sampleRate;
    this.inputChannels = inputChannels;
  }
}

export enum AudioUpstreamType {
  FLAC = 'FLAC',
  OPUS = 'OPUS',
  PCM = 'PCM',
  NOCODEC = 'NOCODEC',
}
