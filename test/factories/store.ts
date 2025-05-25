// test/factories/store.ts
// Factory for creating mock Store objects for tests
import type { Store } from '@prisma/client';

export function makeMockStore(overrides: Partial<Store> = {}): Store {
  return {
    id: 1,
    name: 'Test Store',
    email: 'store@example.com',
    timezone: 'UTC',
    country: 'US',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
