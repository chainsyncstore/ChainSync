declare module 'express-session' {
  interface SessionData {
    [key: string]: any; // allow additional arbitrary fields
    userId?: number;
    userRole?: 'admin' | 'manager' | 'cashier';
    storeId?: number;
    lastActivity?: Date;
    fullName?: string;
  }

  // Some helper libraries (e.g. connect-pg-simple) narrow `req.session` to `Session & Partial<SessionData>`
  // so we also augment the `Session` interface directly to silence “property does not exist” errors.
  // All fields are optional so we do not constrain runtime usage.
  export interface Session extends SessionData {}
  export interface SessionOptions extends Record<string, unknown> {}
  export type SessionStore = any;

  // Provide default export for ESModule import syntax
  const _default: (options?: SessionOptions) => any;
  export default _default;
}

// Also augment Express namespace to ensure `req.session` fields resolve.
import 'express';
declare module 'express-serve-static-core' {
  interface Session extends import('express-session').SessionData {}
}

declare module 'express-session' {
  const session: (options?: import('express-session').SessionOptions) => any;
  export = session;


}
