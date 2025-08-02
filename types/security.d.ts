declare module 'cors' {
  function cors(options?: {
    origin?: string | string[] | boolean | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void);
    methods?: string | string[];
    allowedHeaders?: string | string[];
    exposedHeaders?: string | string[];
    credentials?: boolean;
    maxAge?: number;
  }): (req: any, res: any, next: () => void) => void;
  export = cors;
}


