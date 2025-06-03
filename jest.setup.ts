// jest.setup.ts
// Global test setup for Jest
import { db as mockDbInstance } from './test/factories/db'; // Adjust path as necessary
import { server } from './test/mocks/server'; // MSW server
import { TextEncoder, TextDecoder } from 'util';

// Assign TextEncoder and TextDecoder to global for tests if not already present
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
}


// Mock the database connection for all tests
jest.mock('@/server/db/connection', () => ({
  getDb: jest.fn(() => mockDbInstance), // Use the imported db instance
}));

// Mock the logger for all tests to suppress console output during tests
jest.mock('@/server/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(), // Ensure child() returns the mock itself
  },
}));

// MSW setup: Start the server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));

// MSW teardown: Reset handlers after each test and close server after all tests
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Optional: Clean up any global mocks or state after each test
// afterEach(() => {
//   jest.clearAllMocks();
// });
