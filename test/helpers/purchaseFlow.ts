// test/helpers/purchaseFlow.ts
import { makeMockCustomer } from '../factories/customer';
import { makeMockStore } from '../factories/store';
import { makeMockProduct } from '../factories/product';
import { createStore, createCustomer, createProduct } from '../integration/drizzleTestDb';

export async function setupFullPurchaseFlow(amount: number, initialPoints = 0) {
  const store = await createStore(makeMockStore());
  const customer = await createCustomer(makeMockCustomer({ loyaltyPoints: initialPoints }));
  const product = await createProduct(makeMockProduct());
  // Add inventory if needed (not shown)
  return { store, customer, product };
}
