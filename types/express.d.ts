import { User } from '../shared/schema';

declare global {
  namespace Express {
    export interface Request {
      user?: User;
    }
  }
}
