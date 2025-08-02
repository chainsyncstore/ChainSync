// tests/__mocks__/redis.js
// Minimal Redis client mocks so production-readiness tests can import redis.js without real Redis.

const mockClient = {
  _connect: jest.fn().mockResolvedValue(undefined),
  _quit: jest.fn().mockResolvedValue(undefined),
  _get: jest.fn().mockResolvedValue(null),
  _set: jest.fn().mockResolvedValue('OK'),
  _on: jest.fn()
};

function initRedis() {
  return mockClient;
}

function getRedisClient() {
  return mockClient;
}

module.exports = { initRedis, getRedisClient, __mockClient: mockClient };
