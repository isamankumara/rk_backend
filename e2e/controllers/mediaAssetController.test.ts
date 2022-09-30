import { mediaAssetTypeToBucketFolder } from '../../src/controllers/mediaAssetController';

describe('Media asset controller', () => {
  beforeAll(async () => {
    jest.setTimeout(30000); // this must be the first command, otherwise jest will not honour promises...
  });

  test('mediaAssetTypeToBucketFolder', async () => {
    const userProfileImage = mediaAssetTypeToBucketFolder('USER_PROFILE_IMAGE');
    expect(userProfileImage[1]).toBe('media');
    const questionAudio = mediaAssetTypeToBucketFolder('QUESTION_AUDIO');
    expect(questionAudio[1]).toBe('QUESTION_AUDIO');
    const playableVideo = mediaAssetTypeToBucketFolder('PLAYABLE_VIDEO');
    expect(playableVideo[1]).toBe('PLAYABLE_VIDEO');
    const playableAudio = mediaAssetTypeToBucketFolder('PLAYABLE_AUDIO');
    expect(playableAudio[1]).toBe('PLAYABLE_AUDIO');
    const playableItemPreviewImage = mediaAssetTypeToBucketFolder(
      'PLAYABLE_ITEM_PREVIEW_IMAGE'
    );
    expect(playableItemPreviewImage[1]).toBe('PLAYABLE_ITEM_PREVIEW_IMAGE');
  });

  afterAll(async () => {});
});
