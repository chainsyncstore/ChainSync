import { Request } from 'express';

declare module 'multer' {
    interface MulterError extends Error {
        _code: string;
        field?: string;
        storageErrors?: Error[];
    }

    interface File {
        _fieldname: string;
        _originalname: string;
        _encoding: string;
        _mimetype: string;
        _size: number;
        _destination: string;
        _filename: string;
        _path: string;
        buffer?: Buffer;
    }

    interface MulterOptions {
        dest?: string;
        storage?: StorageEngine;
        limits?: {
            fieldNameSize?: number;
            fileSize?: number;
            files?: number;
            fields?: number;
            parts?: number;
            headerPairs?: number;
        };
        fileFilter?: (
            _req: Request,
            _file: File,
            _callback: (_error: Error | null, _acceptFile: boolean) => void
        ) => void;
    }

    interface StorageEngine {
        _handleFile(
            _req: Request,
            _file: File,
            _callback: (_error: Error | null, _file: File) => void
        ): void;
        _removeFile(
            _req: Request,
            _file: File,
            _callback: (_error: Error | null) => void
        ): void;
    }

    interface MemoryStorageEngine extends StorageEngine {
        getLimit(): number;
    }

    interface DiskStorageEngine extends StorageEngine {
        getLimit(): number;
    }

    interface Multer {
        (options?: MulterOptions): (_req: Request, _res: any, _next: any) => void;
        any(fieldname?: string): (_req: Request, _res: any, _next: any) => void;
        array(_fieldname: string, maxCount?: number): (_req: Request, _res: any, _next: any)
   = > void;
        fields(_fields: Array<{ _name: string; _maxCount: number }>): (_req: Request, _res: any, _next: any)
   = > void;
        single(_fieldname: string): (_req: Request, _res: any, _next: any) => void;
        none(): (_req: Request, _res: any, _next: any) => void;
    }

    const _multer: Multer;
    export = multer;
}

export interface FileFilterCallback {
    (_error: Error | null, _acceptFile: boolean): void;
}
