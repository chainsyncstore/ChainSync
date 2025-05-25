// test/factories/transaction.ts
// Factory for creating mock Transaction objects for tests
import type { Transaction, TransactionType, TransactionStatus } from '@prisma/client';

export function makeMockTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    storeId: 1,
    customerId: 1,
    userId: 1,
    type: 'SALE' as TransactionType,
    status: 'COMPLETED' as TransactionStatus,
    subtotal: '100.00',
    tax: '10.00',
    total: '110.00',
    paymentMethod: 'CASH',
    notes: 'Test transaction',
    reference: 'TXN-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
