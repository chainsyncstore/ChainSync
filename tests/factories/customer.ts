// test/factories/customer.ts
// Factory for creating mock Customer objects for tests
import * as schema from '@shared/schema';

export function makeMockCustomer(
  overrides: Partial<schema.CustomerInsert> = {}
): schema.CustomerInsert {
  return {
    fullName: 'Test Customer',
    email: `customer.${Date.now()}@example.com`,
    phone: '555-1234',
    storeId: 1, // Default storeId, can be overridden in tests
    ...overrides,
  };
}
