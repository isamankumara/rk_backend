import { Request } from 'express';
import { MongoId } from './contentTypes';
import { ParamsDictionary, Query } from 'express-serve-static-core';

export interface AuthedRequest<
  Props extends {
    body?: Record<string, unknown>;
    query?: Query;
    params?: ParamsDictionary;
  } = Record<string, unknown>
> extends Request<Props['params'], undefined, Props['body'], Props['query']> {
  user: {
    id: MongoId;
  };
  files?: {
    avatar: UploadFileRef[];
  };
}

export interface UnAuthedRequest<
  Props extends {
    body?: Record<string, unknown>;
    query?: Query;
    params?: ParamsDictionary;
  } = Record<string, unknown>
> extends Request<Props['params'], undefined, Props['body'], Props['query']> {
  files?: {
    avatar: UploadFileRef[];
  };
}
export type UploadFileRef = {
  originalname: string;
  path: string;
  mimetype: string;
};
