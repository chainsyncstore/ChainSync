import { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';

export interface Request extends ExpressRequest {
  user?: {
    _id: string;
    _role: string;
  };
  progressId?: string;
  files?: MulterFile | MulterFile[];
}

export interface Response extends ExpressResponse {}

export interface MulterFile {
  _fieldname: string;
  _originalname: string;
  _encoding: string;
  _mimetype: string;
  _destination: string;
  _filename: string;
  _path: string;
  _size: number;
  buffer?: Buffer;
}
