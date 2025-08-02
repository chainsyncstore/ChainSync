declare module 'express-csrf' {
  import { RequestHandler } from 'express';
  
  export function csrf(options?: {
    ignoreMethods?: string[];
    ignorePaths?: string[];
    cookie?: boolean;
    cookieName?: string;
    cookieOpts?: any;
    sessionKey?: string;
    headerName?: string;
    bodyName?: string;
    queryName?: string;
    secret?: string;
    saltLength?: number;
    tokenLength?: number;
    ignoreIPs?: string[];
    ignoreUserAgents?: string[];
  }): RequestHandler;
} 