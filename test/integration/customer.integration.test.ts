// test/integration/customer.integration.test.ts
// Integration test for Customer model using Drizzle ORM
import { db } from '../../db';
import * as schema from '@shared/schema';
import { makeMockCustomer } from '../factories/customer';
import { test, describe } from '../testTags';
import { eq } from 'drizzle-orm';

describe.integration('Customer Integration', () => {
  // No need for beforeAll/afterAll with Drizzle connection management

  beforeEach(async() => {
    // Clean the customers table before each test
    await db.delete(schema.customers);
  });

  test.integration('should create and fetch a customer', async() => {
    const mockData = makeMockCustomer({ fullName: 'Alice', email: 'alice@example.com' });

    // Create a customer
    const [created] = await db.insert(schema.customers).values(mockData).returning();

    expect(created).toBeDefined();
    expect(created.fullName).toBe('Alice');
    expect(created.email).toBe('alice@example.com');

    // Fetch the customer
    const [fetched] = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, created.id));

    expect(fetched).toBeDefined();
    expect(fetched.fullName).toBe('Alice');
    expect(fetched.email).toBe('alice@example.com');
  });
});
