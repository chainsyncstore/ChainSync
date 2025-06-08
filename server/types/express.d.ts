import { UserPayload } from './user';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role: string;
        [key: string]: unknown;
      };
    }
  }
}
