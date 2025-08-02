// Jest stub for project-wide logger utilities
// Provides ConsoleLogger with spy-able methods plus createLogger/getLogger APIs.

// Jest stub for project-wide logger utilities
// Minimal implementation to satisfy code that imports src/logging/*

// Base no-op logger implementation
const ConsoleLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  child() {
    return ConsoleLogger;
  }
};

// Active logger reference used by getLogger / createLogger
let activeLogger = ConsoleLogger;

function getLogger() {
  return activeLogger;
}

function setLogger(logger) {
  activeLogger = logger;
}

function createLogger(_opts = {}) {
  return ConsoleLogger;
}

// Provide a class variant used by some imports
class ConsoleLoggerStub {
  static info(..._args) {}
  static warn(..._args) {}
  static error(..._args) {}
  static child() {
    return ConsoleLoggerStub;
  }
}

module.exports = {
  ConsoleLogger: ConsoleLoggerStub,
  Logger: ConsoleLoggerStub,
  createLogger,
  getLogger,
  setLogger,
  default: ConsoleLoggerStub
};
