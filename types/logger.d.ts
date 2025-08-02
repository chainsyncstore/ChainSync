declare module 'logger' {
  export interface Logger {
    log(_level: string, _message: string, meta?: any): void;
    error(_message: string, meta?: any): void;
    warn(_message: string, meta?: any): void;
    info(_message: string, meta?: any): void;
    debug(_message: string, meta?: any): void;
  }

  export const _logger: Logger;
  export default logger;
}
