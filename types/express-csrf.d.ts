declare module 'express-csrf' {
  import { RequestHandler } from 'express';
  
  interface CSRFOptions {
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
  }
  
  export function csrf(options?: CSRFOptions): RequestHandler;
  
  // Also export as default for compatibility
  const _csrfMiddleware: {
    (options?: CSRFOptions): RequestHandler;
  };
  
  export default csrfMiddleware;
} 