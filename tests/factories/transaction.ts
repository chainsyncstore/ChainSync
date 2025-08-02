// test/factories/transaction.ts
// Factory for creating mock Transaction objects for tests
import * as schema from '@shared/schema';

// _Note: We are using TransactionInsert which is derived from the Zod schema.
// The Zod schema has been updated to expect strings for decimal fields.
export function makeMockTransaction(
  _overrides: Partial<schema.TransactionInsert> = {}
): schema.TransactionInsert {
  const _data: schema.TransactionInsert = {
    _storeId: 1,
    _userId: 1,
    _customerId: 1,
    _status: 'completed',
    _total: '110.00',
    _subtotal: '100.00',
    _paymentMethod: 'cash',
    ...overrides
  };
  return data;
}
