import { describe, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getLogger } from '../../src/logging/index.js';
import { env } from '../../server/config/env.js';
import * as schema from '../../shared/schema.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const logger = getLogger().child({ component: 'integration-test-setup' });

// Test database configuration
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/chainsync_test';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: string;
  storeId?: number;
  token?: string;
}

export interface TestData {
  users: TestUser[];
  stores: any[];
  products: any[];
  customers: any[];
  transactions: any[];
}

export class IntegrationTestSetup {
  private db: any;
  private pool: Pool;
  private testData: TestData = {
    users: [],
    stores: [],
    products: [],
    customers: [],
    transactions: []
  };

  constructor() {
    this.pool = new Pool({
      connectionString: TEST_DATABASE_URL,
      max: 1 // Single connection for tests
    });
    
    this.db = drizzle(this.pool, { schema });
  }

  /**
   * Initialize test database
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing test database...');
      
      // Run migrations
      await migrate(this.db, { migrationsFolder: './db/migrations' });
      
      // Seed test data
      await this.seedTestData();
      
      logger.info('Test database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize test database', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Clean up test database
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up test database...');
      
      // Clean up all test data
      await this.cleanupTestData();
      
      // Close database connection
      if (this.pool) {
        await this.pool.end();
      }
      
      logger.info('Test database cleaned up successfully');
    } catch (error) {
      logger.error('Failed to cleanup test database', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Reset database to clean state
   */
  async reset(): Promise<void> {
    try {
      await this.cleanupTestData();
      await this.seedTestData();
    } catch (error) {
      logger.error('Failed to reset test database', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get database instance
   */
  getDatabase() {
    return this.db;
  }

  /**
   * Get test data
   */
  getTestData(): TestData {
    return this.testData;
  }

  /**
   * Create a test user and return authentication token
   */
  async createTestUser(userData: Partial<TestUser> = {}): Promise<TestUser> {
    const defaultUser: TestUser = {
      id: '',
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      role: 'cashier',
      ...userData
    };

    const hashedPassword = await bcrypt.hash(defaultUser.password, 10);

    const [user] = await this.db.insert(schema.users).values({
      email: defaultUser.email,
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      role: defaultUser.role,
      storeId: defaultUser.storeId,
      isActive: true
    }).returning();

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        storeId: user.storeId 
      },
      env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    const testUser: TestUser = {
      ...defaultUser,
      id: user.id,
      token
    };

    this.testData.users.push(testUser);
    return testUser;
  }

  /**
   * Create test store
   */
  async createTestStore(storeData: any = {}): Promise<any> {
    const defaultStore = {
      name: `Test Store ${Date.now()}`,
      address: '123 Test Street, Test City',
      phone: '+1234567890',
      email: `store-${Date.now()}@example.com`,
      isActive: true,
      timezone: 'UTC',
      currency: 'USD',
      ...storeData
    };

    const [store] = await this.db.insert(schema.stores).values(defaultStore).returning();
    this.testData.stores.push(store);
    return store;
  }

  /**
   * Create test product
   */
  async createTestProduct(productData: any = {}): Promise<any> {
    const defaultProduct = {
      name: `Test Product ${Date.now()}`,
      description: 'Test product description',
      sku: `SKU-${Date.now()}`,
      category: 'Test Category',
      unit: 'piece',
      costPrice: 10.00,
      sellingPrice: 15.00,
      taxRate: 10,
      reorderPoint: 5,
      isActive: true,
      storeId: this.testData.stores[0]?.id || 1,
      ...productData
    };

    const [product] = await this.db.insert(schema.products).values(defaultProduct).returning();
    this.testData.products.push(product);
    return product;
  }

  /**
   * Create test customer
   */
  async createTestCustomer(customerData: any = {}): Promise<any> {
    const defaultCustomer = {
      firstName: 'Test',
      lastName: 'Customer',
      email: `customer-${Date.now()}@example.com`,
      phone: '+1234567890',
      address: '456 Customer Street, Customer City',
      loyaltyPoints: 0,
      isActive: true,
      storeId: this.testData.stores[0]?.id || 1,
      ...customerData
    };

    const [customer] = await this.db.insert(schema.customers).values(defaultCustomer).returning();
    this.testData.customers.push(customer);
    return customer;
  }

  /**
   * Create test transaction
   */
  async createTestTransaction(transactionData: any = {}): Promise<any> {
    const defaultTransaction = {
      customerId: this.testData.customers[0]?.id || null,
      paymentMethod: 'cash',
      paymentStatus: 'completed',
      totalAmount: 100.00,
      taxAmount: 10.00,
      discountAmount: 0,
      storeId: this.testData.stores[0]?.id || 1,
      ...transactionData
    };

    const [transaction] = await this.db.insert(schema.transactions).values(defaultTransaction).returning();
    this.testData.transactions.push(transaction);
    return transaction;
  }

  /**
   * Seed test data
   */
  private async seedTestData(): Promise<void> {
    try {
      logger.info('Seeding test data...');

      // Create test store
      const store = await this.createTestStore();

      // Create test users with different roles
      const adminUser = await this.createTestUser({
        email: 'admin@test.com',
        password: 'AdminPassword123!',
        role: 'admin',
        storeId: store.id
      });

      const managerUser = await this.createTestUser({
        email: 'manager@test.com',
        password: 'ManagerPassword123!',
        role: 'manager',
        storeId: store.id
      });

      const cashierUser = await this.createTestUser({
        email: 'cashier@test.com',
        password: 'CashierPassword123!',
        role: 'cashier',
        storeId: store.id
      });

      // Create test products
      const product1 = await this.createTestProduct({
        name: 'Test Product 1',
        sku: 'SKU-001',
        costPrice: 5.00,
        sellingPrice: 10.00
      });

      const product2 = await this.createTestProduct({
        name: 'Test Product 2',
        sku: 'SKU-002',
        costPrice: 15.00,
        sellingPrice: 25.00
      });

      // Create test customers
      const customer1 = await this.createTestCustomer({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com'
      });

      const customer2 = await this.createTestCustomer({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@test.com'
      });

      // Create test transactions
      await this.createTestTransaction({
        customerId: customer1.id,
        totalAmount: 50.00,
        taxAmount: 5.00
      });

      await this.createTestTransaction({
        customerId: customer2.id,
        totalAmount: 75.00,
        taxAmount: 7.50
      });

      logger.info('Test data seeded successfully');
    } catch (error) {
      logger.error('Failed to seed test data', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Clean up test data
   */
  private async cleanupTestData(): Promise<void> {
    try {
      logger.info('Cleaning up test data...');

      // Delete in reverse order to handle foreign key constraints
      await this.db.delete(schema.transactions);
      await this.db.delete(schema.customers);
      await this.db.delete(schema.products);
      await this.db.delete(schema.users);
      await this.db.delete(schema.stores);

      // Reset test data arrays
      this.testData = {
        users: [],
        stores: [],
        products: [],
        customers: [],
        transactions: []
      };

      logger.info('Test data cleaned up successfully');
    } catch (error) {
      logger.error('Failed to cleanup test data', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

// Global test setup instance
let testSetup: IntegrationTestSetup;

/**
 * Setup function for integration tests
 */
export const setupIntegrationTests = () => {
  beforeAll(async () => {
    testSetup = new IntegrationTestSetup();
    await testSetup.initialize();
  });

  afterAll(async () => {
    if (testSetup) {
      await testSetup.cleanup();
    }
  });

  beforeEach(async () => {
    // Reset database state before each test
    if (testSetup) {
      await testSetup.reset();
    }
  });
};

/**
 * Get test setup instance
 */
export const getTestSetup = (): IntegrationTestSetup => {
  if (!testSetup) {
    throw new Error('Test setup not initialized. Call setupIntegrationTests() first.');
  }
  return testSetup;
};

/**
 * Helper function to create authenticated request headers
 */
export const createAuthHeaders = (user: TestUser): Record<string, string> => {
  return {
    'Authorization': `Bearer ${user.token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Helper function to create test request
 */
export const createTestRequest = (user?: TestUser) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (user?.token) {
    headers['Authorization'] = `Bearer ${user.token}`;
  }

  return {
    headers,
    body: {},
    params: {},
    query: {}
  };
};

/**
 * Helper function to create test response
 */
export const createTestResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis()
  };

  return res;
};

/**
 * Helper function to create test next function
 */
export const createTestNext = () => {
  return jest.fn();
};

/**
 * Utility function to wait for async operations
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Utility function to generate random test data
 */
export const generateTestData = {
  email: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`,
  phone: () => `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
  name: () => `Test ${Math.random().toString(36).substr(2, 9)}`,
  sku: () => `SKU-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
  uuid: () => `00000000-0000-0000-0000-${Math.random().toString(36).substr(2, 12)}`
}; 