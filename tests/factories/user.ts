import * as schema from '@shared/schema';

export function makeMockUser(_overrides: Partial<schema.UserInsert> = {}): schema.UserInsert {
  return {
    _name: `testuser_${Date.now()}`,
    _email: `test.user.${Date.now()}@example.com`,
    _password: 'password123', // required field
    _role: 'cashier',
    _storeId: 1,
    ...overrides
  };
}
