// import { NeonDatabase, EnvConfig, FileUploadProgress, LoyaltyMember } from '@types'; // Unused
declare module 'json2csv' {
  export interface Json2CsvOptions {
    fields?: string[] | { [_key: string]: string };
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
    _data: string;
    errors?: string[];
  }

  export function parse<T>(_data: T[], options?: Json2CsvOptions): string;
  export function parse<T>(_data: T[], _callback: (_err: Error | null, _csv: string) => void): void;
  export function parse<T>(_data: T[], _options: Json2CsvOptions, _callback: (_err: Error | null, _csv: string)
   = > void): void;

  export function parseSync<T>(_data: T[], options?: Json2CsvOptions): string;
  export function parseSync<T>(_data: T[], _options: Json2CsvOptions): string;

  export function stringify<T>(_data: T[], options?: Json2CsvOptions): Promise<string>;
  export function stringify<T>(_data: T[], _callback: (_err: Error | null, _csv: string)
   = > void): void;
  export function stringify<T>(_data: T[], _options: Json2CsvOptions, _callback: (_err: Error | null, _csv: string)
   = > void): void;

  export function stringifySync<T>(_data: T[], options?: Json2CsvOptions): string;
  export function stringifySync<T>(_data: T[], _options: Json2CsvOptions): string;
}
