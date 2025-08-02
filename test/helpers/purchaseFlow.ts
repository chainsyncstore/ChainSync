// test/helpers/purchaseFlow.ts
import { db, stores, customers, products } from '../../db/index.js';
import { makeMockCustomer } from '../../tests/factories/customer';
import { makeMockStore } from '../../tests/factories/store';
import { makeMockProduct } from '../../tests/factories/product';

export async function setupFullPurchaseFlow(_dbClient: typeof db, _amount: number, initialPoints
   =  0) {
  const [store] = await dbClient.insert(stores).values(makeMockStore()).returning();
  const [customer] = await dbClient.insert(customers).values(makeMockCustomer({ _loyaltyPoints: initialPoints })).returning();
  const [product] = await dbClient.insert(products).values(makeMockProduct()).returning();
  // Add inventory if needed (not shown)
  return { store, customer, product };
}
