// test/factories/store.ts
// Factory for creating mock Store objects for tests
import * as schema from '@shared/schema';

export function makeMockStore(overrides: Partial<schema.StoreInsert> = {}): schema.StoreInsert {
  return {
    name: 'Test Store',
    address: '123 Test St',
    city: 'Testville',
    state: 'TS',
    country: 'USA',
    phone: '555-555-5555',
    email: `store.${Date.now()}@example.com`,
    timezone: 'UTC',
    ...overrides,
  };
}
