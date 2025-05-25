// test/factories/customer.ts
// Factory for creating mock Customer objects for tests
// NOTE: Add loyaltyEnabled to Customer type if not present in @prisma/client
import type { Customer } from '@prisma/client';

export function makeMockCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 1,
    name: 'Test Customer',
    email: 'customer@example.com',
    phone: '555-1234',
    loyaltyEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
