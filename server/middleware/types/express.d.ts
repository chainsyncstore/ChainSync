import { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';

export interface Request extends ExpressRequest {
  user?: {
    id: string;
    role: string;
  };
  progressId?: string;
  files?: MulterFile | MulterFile[];
}

export interface Response extends ExpressResponse {}

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
  buffer?: Buffer;
}
