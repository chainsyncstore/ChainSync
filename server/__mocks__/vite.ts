// Jest mock for server/vite.ts
module.exports = {
  setupVite: jest.fn(),
  serveStatic: jest.fn(),
  log: jest.fn(),
};
