// test/integration/store.integration.test.ts
import { db } from '../../db';
import * as schema from '@shared/schema';
import { makeMockStore } from '../factories/store';
import { test, describe } from '../testTags';
import { eq } from 'drizzle-orm';

describe.integration('Store Integration', () => {
  beforeEach(async () => {
    await db.delete(schema.stores);
  });

  test.integration('should create and fetch a store', async () => {
    const mockStore = makeMockStore({ name: 'Main Store', email: 'main@store.com' });
    const [created] = await db.insert(schema.stores).values(mockStore).returning();

    expect(created).toBeDefined();
    expect(created.name).toBe('Main Store');
    expect(created.email).toBe('main@store.com');

    const [fetched] = await db.select().from(schema.stores).where(eq(schema.stores.id, created.id));

    expect(fetched).toBeDefined();
    expect(fetched.name).toBe('Main Store');
    expect(fetched.email).toBe('main@store.com');
  });
});
