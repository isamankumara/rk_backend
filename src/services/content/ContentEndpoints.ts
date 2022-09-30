import { Response } from 'express';

// Controller
import {
  preflightContent,
  synchroniseContent,
  auditContent,
  cleardownContent,
} from './ContentController';

// Utils
import { validateOrgIdent } from '../../utils/ContentUtil';

// TS
import { UnAuthedRequest } from '../../ts/types/expressTypes';
import { ContentTypes } from '../../ts/types/contentTypes';

export const preflightContentEndpoint = async (
  req: UnAuthedRequest<{
    params: { orgIdent: string };
    body: { contentTypes: ContentTypes[] };
  }>,
  res: Response
): Promise<void> => {
  try {
    const { orgIdent } = req.params;
    if (!(await validateOrgIdent(orgIdent)))
      res
        .status(403)
        .send(`preflightContentEndpoint invalid orgIdent ${orgIdent} supplied`);
    const { contentTypes } = req.body;
    if (contentTypes) await preflightContent(orgIdent, contentTypes);
    else await preflightContent(orgIdent);
    res.status(200).send();
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
};
export const synchroniseContentEndpoint = async (
  req: UnAuthedRequest<{
    params: { orgIdent: string };
    body: { contentTypes: ContentTypes[]; runPreflightChecks: boolean };
  }>,
  res: Response
): Promise<void> => {
  try {
    const { orgIdent } = req.params;
    if (!(await validateOrgIdent(orgIdent)))
      res
        .status(403)
        .send(
          `synchroniseContentEndpoint invalid orgIdent ${orgIdent} supplied`
        );
    const { contentTypes, runPreflightChecks } = req.body;
    if (contentTypes)
      await synchroniseContent(orgIdent, contentTypes, runPreflightChecks);
    else await synchroniseContent(orgIdent);
    res.status(200).send();
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
};
export const cleardownContentEndpoint = async (
  req: UnAuthedRequest<{
    params: { orgIdent: string };
    body: { contentTypes: ContentTypes[] };
  }>,
  res: Response
): Promise<void> => {
  try {
    const { orgIdent } = req.params;
    if (!(await validateOrgIdent(orgIdent)))
      res
        .status(403)
        .send(`cleardownContentEndpoint invalid orgIdent ${orgIdent} supplied`);
    const { contentTypes } = req.body;
    await cleardownContent(orgIdent, contentTypes);
    res.status(200).send();
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
};
export const auditContentEndpoint = async (
  req: UnAuthedRequest,
  res: Response
): Promise<void> => {
  try {
    await auditContent(res); // for now write the audit outupt to the response
    res.status(200).send();
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
};
