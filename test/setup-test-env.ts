/**
 * Test Environment Setup
 *
 * This file is used to set up the test environment before running tests.
 * It is referenced in jest.config.cjs as setupFilesAfterEnv.
 */

import dotenv from 'dotenv';
import path from 'path';
import { db } from '../server/db/connection';
import { sql } from 'drizzle-orm';

// Load test environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';

// Global test timeouts
jest.setTimeout(30000);

// Global setup - runs before all tests
beforeAll(async () => {
  // Ensure we're using the test database
  if (!process.env.DATABASE_URL?.includes('test')) {
    throw new Error('Tests must use a test database! Check your .env.test file.');
  }

  // Verify database connection
  try {
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log('✅ Connected to test database');
  } catch (error) {
    console.error('❌ Failed to connect to test database', error);
    throw error;
  }
});

// Global teardown - runs after all tests
afterAll(async () => {
  // Close database connection
  // This is important to prevent Jest from hanging
  try {
    // @ts-ignore - We know db.destroy exists but it might not be in the type definitions
    await db.destroy?.();
    console.log('✅ Closed test database connection');
  } catch (error) {
    console.error('❌ Failed to close test database connection', error);
  }
});

// Add global Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});
