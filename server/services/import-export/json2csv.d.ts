import { NeonDatabase, EnvConfig, FileUploadProgress, LoyaltyMember } from '@types';
declare module 'json2csv' {
  export interface Json2CsvOptions {
    fields?: string[] | { [key: string]: string };
    withBOM?: boolean;
    del?: string;
    eol?: string;
    quote?: string;
    quotes?: string;
    doubleQuotes?: string;
    escape?: string;
    forceQuotes?: boolean;
    emptyValue?: string | null;
    defaultValue?: string | null;
    header?: boolean;
    includeEmptyRows?: boolean;
  }

  export interface Json2CsvResult {
    data: string;
    errors?: string[];
  }

  export function parse<T>(data: T[], options?: Json2CsvOptions): string;
  export function parse<T>(data: T[], callback: (err: Error | null, csv: string) => void): void;
  export function parse<T>(
    data: T[],
    options: Json2CsvOptions,
    callback: (err: Error | null, csv: string) => void
  ): void;

  export function parseSync<T>(data: T[], options?: Json2CsvOptions): string;
  export function parseSync<T>(data: T[], options: Json2CsvOptions): string;

  export function stringify<T>(data: T[], options?: Json2CsvOptions): Promise<string>;
  export function stringify<T>(data: T[], callback: (err: Error | null, csv: string) => void): void;
  export function stringify<T>(
    data: T[],
    options: Json2CsvOptions,
    callback: (err: Error | null, csv: string) => void
  ): void;

  export function stringifySync<T>(data: T[], options?: Json2CsvOptions): string;
  export function stringifySync<T>(data: T[], options: Json2CsvOptions): string;
}
