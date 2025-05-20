declare module 'multer' {
  interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    destination: string;
    filename: string;
    path: string;
    size: number;
  }

  type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;
  type FileFilter = (
    req: Request,
    file: MulterFile,
    callback: FileFilterCallback
  ) => void;

  interface FileFilterCallbackError extends Error {
    code: string;
  }

  interface MulterOptions {
    dest?: string;
    storage?: StorageEngine;
    fileFilter?: FileFilter;
    limits?: {
      fieldNameSize?: number;
      fileSize?: number;
      files?: number;
      fields?: number;
      parts?: number;
      headerPairs?: number;
    };
  }

  interface StorageEngine {
    _handleFile(
      req: Request,
      file: MulterFile,
      callback: (error: Error | null, file?: MulterFile) => void
    ): void;
    _removeFile(
      req: Request,
      file: MulterFile,
      callback: (error: Error | null) => void
    ): void;
  }

  interface MemoryStorageOptions {
    limits?: MulterOptions['limits'];
  }

  interface DiskStorageOptions {
    destination?: string | ((req: Request, file: MulterFile, callback: (error: Error | null, destination: string) => void) => void);
    filename?: (req: Request, file: MulterFile, callback: (error: Error | null, filename: string) => void) => void;
    limits?: MulterOptions['limits'];
  }

  interface DiskStorage extends StorageEngine {
    getDestination(): string;
    getFilename(): string;
  }

  interface Request {
    file?: MulterFile;
    files?: { [fieldname: string]: MulterFile[] } | MulterFile[];
  }

  function memoryStorage(options?: MemoryStorageOptions): StorageEngine;
  function diskStorage(options: DiskStorageOptions): StorageEngine;
  function none(): StorageEngine;
  function single(fieldname: string): RequestHandler;
  function array(fieldname: string, maxCount?: number): RequestHandler;
  function fields(fields: Array<{ name: string; maxCount?: number }>): RequestHandler;
  function any(): RequestHandler;

  const multer: {
    memoryStorage: typeof memoryStorage;
    diskStorage: typeof diskStorage;
    none: typeof none;
    single: typeof single;
    array: typeof array;
    fields: typeof fields;
    any: typeof any;
    File: MulterFile;
    Options: MulterOptions;
    StorageEngine: StorageEngine;
  };

  export = multer;
}
