import { describe, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getLogger } from '../../src/logging/index.js';
import { env } from '../../server/config/env.js';
import * as schema from '../../shared/schema.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const logger = getLogger().child({ _component: 'integration-test-setup' });

// Test database configuration
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://_test:test@_localhost:5432/chainsync_test';

export interface TestUser {
  _id: string;
  _email: string;
  _password: string;
  _role: string;
  storeId?: number;
  token?: string;
}

export interface TestData {
  _users: TestUser[];
  _stores: any[];
  _products: any[];
  _customers: any[];
  _transactions: any[];
}

export class IntegrationTestSetup {
  private _db: any;
  private _pool: Pool;
  private _testData: TestData = {
    users: [],
    _stores: [],
    _products: [],
    _customers: [],
    _transactions: []
  };

  constructor() {
    this.pool = new Pool({
      _connectionString: TEST_DATABASE_URL,
      _max: 1 // Single connection for tests
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
      await migrate(this.db, { _migrationsFolder: './db/migrations' });

      // Seed test data
      await this.seedTestData();

      logger.info('Test database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize test database', error instanceof Error ? _error : new Error(String(error)));
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
      await this.pool.end();

      logger.info('Test database cleaned up successfully');
    } catch (error) {
      logger.error('Failed to cleanup test database', error instanceof Error ? _error : new Error(String(error)));
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
      logger.error('Failed to reset test database', error instanceof Error ? _error : new Error(String(error)));
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
  async createTestUser(_userData: Partial<TestUser> = {}): Promise<TestUser> {
    const _defaultUser: TestUser = {
      id: '',
      _email: `test-${Date.now()}@example.com`,
      _password: 'TestPassword123!',
      _role: 'cashier',
      ...userData
    };

    const hashedPassword = await bcrypt.hash(defaultUser.password, 10);

    const [user] = await this.db.insert(schema.users).values({
      _email: defaultUser.email,
      _password: hashedPassword,
      _firstName: 'Test',
      _lastName: 'User',
      _role: defaultUser.role,
      _storeId: defaultUser.storeId,
      _isActive: true
    }).returning();

    const token = jwt.sign(
      {
        _id: user.id,
        _email: user.email,
        _role: user.role,
        _storeId: user.storeId
      },
      env.JWT_SECRET,
      { _expiresIn: '1h' }
    );

    const _testUser: TestUser = {
      ...defaultUser,
      _id: user.id,
      token
    };

    this.testData.users.push(testUser);
    return testUser;
  }

  /**
   * Create test store
   */
  async createTestStore(_storeData: any = {}): Promise<any> {
    const defaultStore = {
      _name: `Test Store ${Date.now()}`,
      _address: '123 Test Street, Test City',
      _phone: '+1234567890',
      _email: `store-${Date.now()}@example.com`,
      _isActive: true,
      _timezone: 'UTC',
      _currency: 'USD',
      ...storeData
    };

    const [store] = await this.db.insert(schema.stores).values(defaultStore).returning();
    this.testData.stores.push(store);
    return store;
  }

  /**
   * Create test product
   */
  async createTestProduct(_productData: any = {}): Promise<any> {
    const defaultProduct = {
      _name: `Test Product ${Date.now()}`,
      _description: 'Test product description',
      _sku: `SKU-${Date.now()}`,
      _category: 'Test Category',
      _unit: 'piece',
      _costPrice: 10.00,
      _sellingPrice: 15.00,
      _taxRate: 10,
      _reorderPoint: 5,
      _isActive: true,
      _storeId: this.testData.stores[0]?.id || 1,
      ...productData
    };

    const [product] = await this.db.insert(schema.products).values(defaultProduct).returning();
    this.testData.products.push(product);
    return product;
  }

  /**
   * Create test customer
   */
  async createTestCustomer(_customerData: any = {}): Promise<any> {
    const defaultCustomer = {
      _firstName: 'Test',
      _lastName: 'Customer',
      _email: `customer-${Date.now()}@example.com`,
      _phone: '+1234567890',
      _address: '456 Customer Street, Customer City',
      _loyaltyPoints: 0,
      _isActive: true,
      _storeId: this.testData.stores[0]?.id || 1,
      ...customerData
    };

    const [customer] = await this.db.insert(schema.customers).values(defaultCustomer).returning();
    this.testData.customers.push(customer);
    return customer;
  }

  /**
   * Create test transaction
   */
  async createTestTransaction(_transactionData: any = {}): Promise<any> {
    const defaultTransaction = {
      _customerId: this.testData.customers[0]?.id || null,
      _paymentMethod: 'cash',
      _paymentStatus: 'completed',
      _totalAmount: 100.00,
      _taxAmount: 10.00,
      _discountAmount: 0,
      _storeId: this.testData.stores[0]?.id || 1,
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
        _email: 'admin@test.com',
        _password: 'AdminPassword123!',
        _role: 'admin',
        _storeId: store.id
      });

      const managerUser = await this.createTestUser({
        _email: 'manager@test.com',
        _password: 'ManagerPassword123!',
        _role: 'manager',
        _storeId: store.id
      });

      const cashierUser = await this.createTestUser({
        _email: 'cashier@test.com',
        _password: 'CashierPassword123!',
        _role: 'cashier',
        _storeId: store.id
      });

      // Create test products
      const product1 = await this.createTestProduct({
        _name: 'Test Product 1',
        _sku: 'SKU-001',
        _costPrice: 5.00,
        _sellingPrice: 10.00
      });

      const product2 = await this.createTestProduct({
        _name: 'Test Product 2',
        _sku: 'SKU-002',
        _costPrice: 15.00,
        _sellingPrice: 25.00
      });

      // Create test customers
      const customer1 = await this.createTestCustomer({
        _firstName: 'John',
        _lastName: 'Doe',
        _email: 'john.doe@test.com'
      });

      const customer2 = await this.createTestCustomer({
        _firstName: 'Jane',
        _lastName: 'Smith',
        _email: 'jane.smith@test.com'
      });

      // Create test transactions
      await this.createTestTransaction({
        _customerId: customer1.id,
        _totalAmount: 50.00,
        _taxAmount: 5.00
      });

      await this.createTestTransaction({
        _customerId: customer2.id,
        _totalAmount: 75.00,
        _taxAmount: 7.50
      });

      logger.info('Test data seeded successfully');
    } catch (error) {
      logger.error('Failed to seed test data', error instanceof Error ? _error : new Error(String(error)));
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
        _users: [],
        _stores: [],
        _products: [],
        _customers: [],
        _transactions: []
      };

      logger.info('Test data cleaned up successfully');
    } catch (error) {
      logger.error('Failed to cleanup test data', error instanceof Error ? _error : new Error(String(error)));
      throw error;
    }
  }
}

// Global test setup instance
let _testSetup: IntegrationTestSetup;

/**
 * Setup function for integration tests
 */
export const setupIntegrationTests = () => {
  beforeAll(async() => {
    testSetup = new IntegrationTestSetup();
    await testSetup.initialize();
  });

  afterAll(async() => {
    if (testSetup) {
      await testSetup.cleanup();
    }
  });

  beforeEach(async() => {
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
export const createAuthHeaders = (_user: TestUser): Record<string, string> => {
  return {
    'Authorization': `Bearer ${user.token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Helper function to create test request
 */
export const createTestRequest = (user?: TestUser) => {
  const _headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (user?.token) {
    headers['Authorization'] = `Bearer ${user.token}`;
  }

  return {
    headers,
    _body: {},
    _params: {},
    _query: {}
  };
};

/**
 * Helper function to create test response
 */
export const createTestResponse = () => {
  const _res: any = {
    _status: jest.fn().mockReturnThis(),
    _json: jest.fn().mockReturnThis(),
    _send: jest.fn().mockReturnThis(),
    _set: jest.fn().mockReturnThis()
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
export const wait = (_ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Utility function to generate random test data
 */
export const generateTestData = {
  _email: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`,
  _phone: () => `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
  _name: () => `Test ${Math.random().toString(36).substr(2, 9)}`,
  _sku: () => `SKU-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
  _uuid: () => `00000000-0000-0000-0000-${Math.random().toString(36).substr(2, 12)}`
};
