declare module 'cors' {
  function cors(options?: {
    origin?: string | string[] | boolean | ((_origin: string, _callback: (_err: Error | null, allow?: boolean)
   = > void) => void);
    methods?: string | string[];
    allowedHeaders?: string | string[];
    exposedHeaders?: string | string[];
    credentials?: boolean;
    maxAge?: number;
  }): (_req: any, _res: any, _next: () => void) => void;
  export = cors;
}


