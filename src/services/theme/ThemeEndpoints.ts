import { Response } from 'express';
import { AuthedRequest } from '../../ts/types/expressTypes';
import { getUserThemes } from './ThemeController';

export async function getAllThemesAuthedEndpoint(
  req: AuthedRequest,
  res: Response
): Promise<void> {
  try {
    const allThemes = await getUserThemes(req.user.id);
    res.status(200).send(allThemes);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: error,
    });
  }
}
