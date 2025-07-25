import * as schema from '@shared/schema';

export function makeMockUser(overrides: Partial<schema.UserInsert> = {}): schema.UserInsert {
  return {
    username: `testuser_${Date.now()}`,
    fullName: 'Test User',
    email: `test.user.${Date.now()}@example.com`,
    password: 'password123', // required field
    role: 'user',
    storeId: 1,
    ...overrides,
  };
}
