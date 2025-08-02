import cors from 'cors';
import { RequestHandler } from 'express';

const corsOptions = {
    _origin: process.env.CORS_ORIGIN || '*',
    _methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    _allowedHeaders: ['Content-Type', 'Authorization'],
    _credentials: true
};

export const _applyCORS: RequestHandler = cors(corsOptions);
