// test/integration/store.integration.test.ts

import { makeMockStore } from '../factories/store';
import { test, describe } from '../testTags';
import { clearStores, createStore, findStoreById } from './drizzleTestDb';



describe.integration('Store Integration', () => {
  beforeAll(async () => {
    // await drizzleDb.connect(); // Replace with Drizzle ORM connect if needed
  });
  afterAll(async () => {
    // await drizzleDb.disconnect(); // Replace with Drizzle ORM disconnect if needed
  });
  beforeEach(async () => {
    await clearStores();
  });

  test.integration('should create and fetch a store', async () => {
    const mockStore = makeMockStore({ name: 'Main Store', email: 'main@store.com' });
    const created = await createStore(mockStore);
    if (!created) throw new Error('Failed to create store');
    expect(created).toMatchObject({ name: 'Main Store', email: 'main@store.com' });

    const fetched = await findStoreById((created as any).id);
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('Main Store');
    expect(fetched?.email).toBe('main@store.com');
  });
});
