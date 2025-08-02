// tests/__mocks__/redis.js
// Minimal Redis client mocks so production-readiness tests can import redis.js without real Redis.

const mockClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  on: jest.fn()
};

function initRedis() {
  return mockClient;
}

function getRedisClient() {
  return mockClient;
}

module.exports = { initRedis, getRedisClient, __mockClient: mockClient };
