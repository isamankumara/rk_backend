import os from 'os';
const { EOL } = os;
import { HlsChunk } from '../ts/types/audioTypes';

export const writeM3uManifest = (hlsChunks: HlsChunk[], writeStream) => {
  const totalDuration = hlsChunks.reduce((cumDuration, chunk) => {
    return cumDuration + chunk.duration;
  }, 0);

  // write m3u header
  writeStream.setHeader('Content-Type', 'audio/x-mpegurl');
  writeStream.write(
    `#EXTM3U${EOL}#EXT-X-TARGETDURATION:${Math.trunc(
      totalDuration
    )}${EOL}#EXT-X-MEDIA-SEQUENCE:0${EOL}`
  );

  // write segment entries
  for (const chunk of hlsChunks)
    writeStream.write(
      `#EXTINF:${Math.trunc(chunk.duration)}, no desc${EOL}${chunk.url}${EOL}`
    );

  writeStream.end('#EXT-X-ENDLIST');
};
