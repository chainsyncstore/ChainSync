import { Request } from 'express';

declare module 'multer' {
    interface MulterError extends Error {
        code: string;
        field?: string;
        storageErrors?: Error[];
    }

    interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
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
            req: Request,
            file: File,
            callback: (error: Error | null, acceptFile: boolean) => void
        ) => void;
    }

    interface StorageEngine {
        _handleFile(
            req: Request,
            file: File,
            callback: (error: Error | null, file: File) => void
        ): void;
        _removeFile(
            req: Request,
            file: File,
            callback: (error: Error | null) => void
        ): void;
    }

    interface MemoryStorageEngine extends StorageEngine {
        getLimit(): number;
    }

    interface DiskStorageEngine extends StorageEngine {
        getLimit(): number;
    }

    interface Multer {
        (options?: MulterOptions): (req: Request, res: unknown, next: unknown) => void;
        any(fieldname?: string): (req: Request, res: unknown, next: unknown) => void;
        array(fieldname: string, maxCount?: number): (req: Request, res: unknown, next: unknown) => void;
        fields(fields: Array<{ name: string; maxCount: number }>): (req: Request, res: unknown, next: unknown) => void;
        single(fieldname: string): (req: Request, res: unknown, next: unknown) => void;
        none(): (req: Request, res: unknown, next: unknown) => void;
    }

    const multer: Multer;
    export = multer;
}

export interface FileFilterCallback {
    (error: Error | null, acceptFile: boolean): void;
}
