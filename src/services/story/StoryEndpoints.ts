import { Response } from 'express';
import axios from 'axios';

// Controller
import {
  getStoryTracks,
  getStoryHls,
  createStoryStub,
  restoreStory,
  publishStory,
  saveStory,
  likeStory,
  unlikeStory,
  updateStoryDetails,
  deleteStory,
  getStoryById,
  sendFinalisationEmail,
  getStories,
} from './StoryController';

// Helpers
import { getUserOrg } from '../../utils/UserUtil';

// TS
import { AuthedRequest, UnAuthedRequest } from '../../ts/types/expressTypes';
import {
  StoryMetadata,
  PublishStoryData,
  Story,
} from '../../ts/types/contentTypes';

export const getStoryTracksEndpoint = async (
  req: UnAuthedRequest<{ params: { storyId: string } }>,
  res: Response
): Promise<void> => {
  try {
    const { storyId } = req.params;
    const tracks = await getStoryTracks(storyId);
    res.status(200).send(tracks);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  }
};
export const getStoryHlsEndpoint = async (
  req: AuthedRequest<{ params: { storyId: string } }>,
  res: Response
): Promise<void> => {
  try {
    const { storyId } = req.params;
    await getStoryHls(storyId, res);
    res.status(200);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  }
};
export const createStoryStubAuthedEndpoint = async (
  req: AuthedRequest<{ body: { topicId: string; isPublic: boolean } }>,
  res: Response
): Promise<void> => {
  try {
    const { topicId, isPublic } = req.body;
    const storyStub = await createStoryStub(req.user.id, topicId, isPublic);
    res.status(200).send(storyStub);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  }
};
export const restoreStoryAuthedEndpoint = async (
  req: AuthedRequest<{ params: { storyId: string } }>,
  res: Response
): Promise<void> => {
  try {
    const { storyId } = req.params;
    const restoredStory = await restoreStory(storyId);
    res.status(200).send(restoredStory);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  }
};
export const getStoryByIdAuthedEndpoint = async (
  req: AuthedRequest<{ params: { storyId: string } }>,
  res: Response
): Promise<void> => {
  try {
    const { storyId } = req.params;
    const story = await getStoryById(storyId);
    res.status(200).send(story);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  }
};
export const publishStoryAuthedEndpoint = async (
  req: AuthedRequest<{
    params: { storyId: string };
    body: { storyData: PublishStoryData; skipFinalise: boolean };
  }>,
  res: Response
): Promise<void> => {
  const { storyId } = req.params;
  const userOrg = await getUserOrg(req.user.id);
  const { storyData, skipFinalise } = req.body;
  let publishedStory: Story;
  try {
    publishedStory = await publishStory(storyId, storyData);
    res.status(200).send(publishedStory);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error });
  }
  try {
    if (
      (!process.env.STORY_FINALISATION_POLICY ||
        process.env.STORY_FINALISATION_POLICY === 'INLINE') &&
      !skipFinalise
    ) {
      axios
        .get(`${userOrg.tasksBaseRoute}/finaliseStory/${storyId}`)
        .then(resp => {
          console.log('finaliseStory returns ', resp.data);
          sendFinalisationEmail(publishedStory);
        })
        .catch(err => {
          console.error('finalise story error ', err);
        });
    }
  } catch (error) {
    console.error(error);
  }
};
export const saveStoryAuthedEndpoint = async (
  req: AuthedRequest<{
    params: { storyId: string };
    body: { title: string; metadata: StoryMetadata; progress: number };
  }>,
  res: Response
): Promise<void> => {
  try {
    const { storyId } = req.params;
    const { metadata, title, progress } = req.body;
    await saveStory(storyId, title, metadata, progress);
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send({
      message: `An error has occurred: ${error}`,
    });
  }
};
export const likeStoryAuthedEndpoint = async (
  req: AuthedRequest<{ body: { storyID: string } }>,
  res: Response
): Promise<void> => {
  try {
    const storyId = req.body.storyID;
    await likeStory(req.user.id, storyId);
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send({
      message: `An error has occurred: ${error}`,
    });
  }
};
export const unlikeStoryAuthedEndpoint = async (
  req: AuthedRequest<{ body: { storyID: string } }>,
  res: Response
): Promise<void> => {
  try {
    const storyId = req.body.storyID;
    await unlikeStory(req.user.id, storyId);
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send({
      message: `An error has occurred: ${error}`,
    });
  }
};
export const updateStoryDetailsAuthedEndpoint = async (
  req: AuthedRequest<{
    params: { storyId: string };
    body: {
      storyDetails: {
        title: string;
        isPublic: boolean;
        tags?: string[];
        storyTellers?: string[];
      };
    };
  }>,
  res: Response
): Promise<void> => {
  try {
    const { storyId } = req.params;
    const { title, isPublic, tags, storyTellers } = req.body.storyDetails;
    const updatedStory = await updateStoryDetails(
      storyId,
      title,
      isPublic,
      tags,
      storyTellers
    );
    res.status(200).send(updatedStory);
  } catch (error) {
    console.error(error);
    res.status(500).send({
      message: `An error has occurred: ${error}`,
    });
  }
};
export const deleteStoryAuthedEndpoint = async (
  req: AuthedRequest<{ params: { storyId: string } }>,
  res: Response
): Promise<void> => {
  try {
    const { storyId } = req.params;
    await deleteStory(storyId);
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send({
      message: `An error has occurred: ${error}`,
    });
  }
};

export const getStoryByOrgAuthedEndpoint = async (
  req: AuthedRequest,
  res: Response
): Promise<void> => {
  try {
    const stories = await getStories(req.user.id);
    res.status(200).send(stories);
  } catch (error) {
    console.error(error);
    res.status(500).send({
      message: `An error has occurred: ${error}`,
    });
  }
};
