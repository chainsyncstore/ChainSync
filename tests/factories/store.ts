// test/factories/store.ts
// Factory for creating mock Store objects for tests
import * as schema from '@shared/schema';

export function makeMockStore(_overrides: Partial<schema.StoreInsert> = {}): schema.StoreInsert {
  return {
    _name: 'Test Store',
    _location: 'Test Location',
    _address: '123 Test St',
    _city: 'Testville',
    _state: 'TS',
    _country: 'USA',
    _phone: '555-555-5555',
    _email: `store.${Date.now()}@example.com`,
    _timezone: 'UTC',
    ...overrides
  };
}
