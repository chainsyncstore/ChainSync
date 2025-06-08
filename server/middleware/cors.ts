import cors from 'cors';
import { Request, Response, NextFunction, RequestHandler } from 'express';

const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

export const applyCORS: RequestHandler = cors(corsOptions);
