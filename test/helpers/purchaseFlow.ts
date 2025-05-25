// test/helpers/purchaseFlow.ts
import { PrismaClient } from '@prisma/client';
import { makeMockCustomer } from '../factories/customer';
import { makeMockStore } from '../factories/store';
import { makeMockProduct } from '../factories/product';

export async function setupFullPurchaseFlow(prisma: PrismaClient, amount: number, initialPoints = 0) {
  const store = await prisma.store.create({ data: makeMockStore() });
  const customer = await prisma.customer.create({ data: makeMockCustomer({ loyaltyPoints: initialPoints }) });
  const product = await prisma.product.create({ data: makeMockProduct() });
  // Add inventory if needed (not shown)
  return { store, customer, product };
}
