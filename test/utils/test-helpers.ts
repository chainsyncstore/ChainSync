/**
 * Test Utilities and Helpers
 * 
 * This file contains reusable test utilities and fixtures for writing
 * consistent, maintainable tests across the ChainSync application.
 */

import { db } from '../../server/db/connection';
import { insertOne, executeQuery } from '../../server/db/sqlHelpers';
import { products, users, orders, stores, customers } from '../../server/db/schema';
import { sql } from 'drizzle-orm';
import type { 
  Product, 
  User, 
  Order, 
  Store, 
  Customer 
} from '../../server/db/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Start a database transaction for test isolation
 */
export async function startTestTransaction() {
  await db.execute(sql`BEGIN`);
}

/**
 * Roll back a database transaction after test
 */
export async function rollbackTestTransaction() {
  await db.execute(sql`ROLLBACK`);
}

/**
 * Clean up database state after tests
 */
export async function cleanupTestDatabase() {
  // Only use in test environment!
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('cleanupTestDatabase can only be used in test environment');
  }
  
  const tables = [
    'order_items',
    'orders',
    'products',
    'customers',
    'users',
    'stores',
    'loyalty_transactions',
    'loyalty_rewards',
    'loyalty_members',
    'loyalty_tiers',
    'loyalty_programs'
  ];
  
  for (const table of tables) {
    await db.execute(sql`TRUNCATE TABLE ${sql.identifier(table)} CASCADE`);
  }
}

/**
 * Generate test data fixtures
 */

export async function createTestProduct(overrides: Partial<Product> = {}): Promise<Product> {
  const defaultProduct = {
    name: `Test Product ${uuidv4().substring(0, 8)}`,
    description: 'A product created for testing purposes',
    price: 9.99,
    sku: `TEST-${Date.now()}`,
    imageUrl: 'https://example.com/test-image.jpg',
    isActive: true,
    storeId: overrides.storeId || (await createTestStore()).id,
    categoryId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const productData = { ...defaultProduct, ...overrides };
  const result = await insertOne<unknown, Product>(db, products, productData);
  return result;
}

export async function createTestUser(overrides: Partial<User> = {}): Promise<User> {
  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    passwordHash: 'not-a-real-hash',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    isActive: true,
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const userData = { ...defaultUser, ...overrides };
  const result = await insertOne<unknown, User>(db, users, userData);
  return result;
}

export async function createTestStore(overrides: Partial<Store> = {}): Promise<Store> {
  const defaultStore = {
    name: `Test Store ${uuidv4().substring(0, 8)}`,
    address: '123 Test Street',
    city: 'Test City',
    state: 'TS',
    zipCode: '12345',
    phone: '555-555-5555',
    email: `store-${Date.now()}@example.com`,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const storeData = { ...defaultStore, ...overrides };
  const result = await insertOne<unknown, Store>(db, stores, storeData);
  return result;
}

export async function createTestCustomer(overrides: Partial<Customer> = {}): Promise<Customer> {
  const defaultCustomer = {
    email: `customer-${Date.now()}@example.com`,
    firstName: 'Test',
    lastName: 'Customer',
    phone: '555-123-4567',
    address: '456 Customer Lane',
    city: 'Customer City',
    state: 'CS',
    zipCode: '54321',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const customerData = { ...defaultCustomer, ...overrides };
  const result = await insertOne<unknown, Customer>(db, customers, customerData);
  return result;
}

export async function createTestOrder(overrides: Partial<Order> = {}): Promise<Order> {
  // Create required related entities if not provided
  if (!overrides.customerId) {
    const customer = await createTestCustomer();
    overrides.customerId = customer.id;
  }
  
  if (!overrides.storeId) {
    const store = await createTestStore();
    overrides.storeId = store.id;
  }
  
  const defaultOrder = {
    status: 'pending',
    total: 99.99,
    tax: 8.25,
    discount: 0,
    paymentMethod: 'credit_card',
    notes: 'Test order',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const orderData = { ...defaultOrder, ...overrides };
  const result = await insertOne<unknown, Order>(db, orders, orderData);
  return result;
}

/**
 * Mock utilities
 */

export function createMockLogger() {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    })
  };
}

export function createMockDb() {
  return {
    query: jest.fn(),
    execute: jest.fn(),
    transaction: jest.fn().mockImplementation(async (cb) => {
      const mockTxDb = {
        query: jest.fn(),
        execute: jest.fn()
      };
      return cb(mockTxDb);
    })
  };
}

/**
 * Validation helpers
 */

export function expectValidationError(promise: Promise<any>, expectedMessage?: string) {
  return expect(promise).rejects.toMatchObject({
    name: 'ZodError',
    ...(expectedMessage ? { message: expect.stringContaining(expectedMessage) } : {})
  });
}

/**
 * Test environment setup
 */

export function setupTestEnv() {
  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

/**
 * Jest matchers extension
 */
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});
