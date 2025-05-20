declare module './utils/file-utils' {
  export interface FileValidationConfig {
    allowedFileTypes: string[];
    maxFileSize: number;
  }

  export class FileUtils {
    static validateFileExtension(fileType: string): Promise<boolean>;
  }
}
