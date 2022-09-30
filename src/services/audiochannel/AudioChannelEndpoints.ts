import { Response } from 'express';
import axios from 'axios';

// Controller
import {
  requestChannel,
  clearChannel,
  upstreamHLS,
  downstreamChannel,
} from './AudioChannelController';

// Helpers
import { getUserOrg } from '../../utils/UserUtil';

// TS
import { AuthedRequest, UnAuthedRequest } from '../../ts/types/expressTypes';
import { AudioBuffer, AudioUpstreamType } from '../../ts/types/audioTypes';

export const downstreamChannelEndpoint = async (
  req: UnAuthedRequest<{
    params: {
      channelId: string;
    };
  }>,
  res: Response
): Promise<void> => {
  try {
    const { channelId } = req.params;
    const result = await downstreamChannel(channelId, res);
    if (result.error)
      res.status(result.status).send({ message: result.message });
    else res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  }
};
export const requestChannelAuthedEndpoint = async (
  req: AuthedRequest<{
    body: { storyId: string; sampleRate: number };
  }>,
  res: Response
): Promise<void> => {
  try {
    const { storyId, sampleRate } = req.body;
    const channelId = await requestChannel(storyId, sampleRate);
    res.status(200).send({ channelId });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  }
};
export const clearChannelAuthedEndpoint = async (
  req: AuthedRequest<{
    body: { channelId: string };
  }>,
  res: Response
): Promise<void> => {
  try {
    const { channelId } = req.body;
    const result = await clearChannel(channelId);
    if (result.error)
      res.status(result.status).send({ message: result.message });
    else res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  }
};
export const upstreamHLSAuthedEndpoint = async (
  req: AuthedRequest<{
    body: {
      syncToDB: boolean;
      channelId: string;
      chunkId: string;
      chunk: AudioBuffer;
      chunkMap: string[];
      upstreamType: AudioUpstreamType;
      doChunkProcessing?: boolean;
    };
  }>,
  res: Response
): Promise<void> => {
  try {
    const {
      syncToDB,
      channelId,
      chunkId,
      chunk,
      chunkMap,
      upstreamType,
      doChunkProcessing = true
    } = req.body;
    const userOrg = await getUserOrg(req.user.id);
    const upstreamResult = await upstreamHLS(
      channelId,
      chunk,
      chunkId,
      syncToDB,
      chunkMap,
    );
    if (upstreamResult.status !== 200) {
      res.status(upstreamResult.status).send({ message: upstreamResult.message});
      return;
  }
    if (doChunkProcessing) {
      // do not await since it will hold up client
      axios.put(`${userOrg.tasksBaseRoute}/processAudioChunk/${channelId}/${chunkId}/${upstreamType}/${syncToDB}`)
        .catch(err => {
          console.error('processAudioChunk error ', err);
        });
    }
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  } finally {
    req.body.chunk = null; // prevent memory leak
  }
};
