// test/factories/customer.ts
// Factory for creating mock Customer objects for tests
import * as schema from '@shared/schema';

export function makeMockCustomer(
  _overrides: Partial<schema.CustomerInsert> = {}
): schema.CustomerInsert {
  return {
    _fullName: 'Test Customer',
    _email: `customer.${Date.now()}@example.com`,
    _phone: '555-1234',
    _storeId: 1, // Default storeId, can be overridden in tests
    ...overrides
  };
}
