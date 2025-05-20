declare module 'csurf' {
  import { RequestHandler } from 'express';

  interface CsrfOptions {
    cookie?: boolean | {
      key?: string;
      path?: string;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: boolean | 'lax' | 'strict' | 'none';
    };
    value?: (req: any) => string;
    ignoreMethods?: string[];
  }

  function csrf(options?: CsrfOptions): RequestHandler;
  export = csrf;
}
