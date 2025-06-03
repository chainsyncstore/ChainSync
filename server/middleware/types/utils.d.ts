import { Request } from 'express'; // Keep if Role or FileUtils are used with it.

// Removed local User interface. Use UserPayload from server/types/express.d.ts or a central User type.
// export interface User { ... }

export interface Role {
    id: string;
    name: string;
    permissions: string[];
}

// Removed local AppError, ErrorCategory, ErrorCode. Use from shared/types/errors.ts via server/middleware/types/app-error.ts
// export interface AppError extends Error { ... }
// export enum ErrorCategory { ... }
// export enum ErrorCode { ... }

export interface FileUtils {
    VALID_FILENAME_REGEX: RegExp;
    sanitizeFilename(filename: string): string;
    validateFilename(filename: string): boolean;
    validateFileExtension(mimeType: string): boolean;
    calculateFileSize(buffer: Buffer): number;
    calculateFileHash(buffer: Buffer): Promise<string>;
}

// Removed FileUploadConfig, FileUploadErrors, ProgressSubscription, FileUploadProgress
// These are (or should be) defined in server/middleware/types/file-upload.d.ts
// export interface FileUploadConfig { ... }
// export interface FileUploadErrors { ... }
// export interface ProgressSubscription { ... }
// export interface FileUploadProgress { ... }
