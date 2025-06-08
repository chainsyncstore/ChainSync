// test/factories/customer.ts
// Factory for creating mock Customer objects for tests
import type { InferModel } from 'drizzle-orm';
import { customers } from '../../shared/db';

export function makeMockCustomer(
  overrides: Partial<InferModel<typeof customers>> = {}
): InferModel<typeof customers> {
  return {
    id: 1,
    name: 'Test Customer',
    email: 'customer@example.com',
    phone: '555-1234',
    loyaltyEnabled: true,
    loyaltyPoints: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
