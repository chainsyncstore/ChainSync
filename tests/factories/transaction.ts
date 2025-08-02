// test/factories/transaction.ts
// Factory for creating mock Transaction objects for tests
import * as schema from '@shared/schema';

// Note: We are using TransactionInsert which is derived from the Zod schema.
// The Zod schema has been updated to expect strings for decimal fields.
export function makeMockTransaction(
  overrides: Partial<schema.TransactionInsert> = {}
): schema.TransactionInsert {
  const data: schema.TransactionInsert = {
    storeId: 1,
    userId: 1,
    customerId: 1,
    status: 'completed',
    total: '110.00',
    subtotal: '100.00',
    paymentMethod: 'cash',
    ...overrides,
  };
  return data;
}
