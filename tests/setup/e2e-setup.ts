import { jest } from '@jest/globals';

// E2E test setup
beforeAll(async() => {
  // Setup test database or external services if needed
  console.log('E2E test setup initialized');
});

afterAll(async() => {
  // Cleanup test database or external services
  console.log('E2E test setup cleaned up');
});

// Global test timeout for E2E tests
jest.setTimeout(30000);
