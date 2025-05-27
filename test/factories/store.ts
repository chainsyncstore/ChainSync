// test/factories/store.ts
// Factory for creating mock Store objects for tests
import type { NewStore } from '../../shared/db/stores';

export function makeMockStore(overrides: Partial<NewStore> = {}): NewStore {
  return {
    name: 'Test Store',
    address: '123 Main St',
    city: 'Sample City',
    state: 'CA',
    country: 'US',
    phone: '+1234567890',
    email: 'store@example.com',
    timezone: 'UTC',
    status: 'active',
    ...overrides,
  };
}

