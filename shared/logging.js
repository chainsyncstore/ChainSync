// Minimal logger stub for TypeScript compatibility
export class Logger {
  info(...args) {}
  warn(...args) {}
  error(...args) {}
  debug(...args) {}
}
export function getLogger(name, opts) {
  return new Logger();
}
