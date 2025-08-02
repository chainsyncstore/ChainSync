import * as schema from '@shared/schema';

export function makeMockUser(overrides: Partial<schema.UserInsert> = {}): schema.UserInsert {
  return {
    name: `testuser_${Date.now()}`,
    email: `test.user.${Date.now()}@example.com`,
    password: 'password123', // required field
    role: 'cashier',
    storeId: 1,
    ...overrides,
  };
}
