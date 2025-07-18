import { eq } from 'drizzle-orm';
import { beforeEach, afterEach, expect } from '@jest/globals';
import { db } from '../../../db';
import { TransactionService } from '../../../server/services/transaction/service';
import {
  CreateTransactionParams,
  PaymentMethod,
  TransactionType,
} from '../../../server/services/transaction/types';
import * as schema from '@shared/schema';
import { makeMockCustomer } from '../../factories/customer';
import { makeMockInventoryItem } from '../../factories/inventoryItem';
import { makeMockProduct } from '../../factories/product';
import { makeMockStore } from '../../factories/store';
import { makeMockUser } from '../../factories/user';
import { describe, test } from '../../testTags';

const transactionService = new TransactionService();

describe.integration('TransactionService Integration', () => {
  let store: schema.Store;
  let customer: schema.Customer;
  let product: schema.Product;
  let user: schema.User;
  let category: schema.Category;

  beforeEach(async () => {
    // Clean up database
    await db.delete(schema.transactionItems);
    await db.delete(schema.transactions);
    await db.delete(schema.inventory);
    await db.delete(schema.products);
    await db.delete(schema.categories);
    await db.delete(schema.customers);
    await db.delete(schema.users);
    await db.delete(schema.stores);

    // Seed database
    [store] = await db.insert(schema.stores).values(makeMockStore()).returning();
    [user] = await db
      .insert(schema.users)
      .values(makeMockUser({ storeId: store.id }))
      .returning();
    [customer] = await db
      .insert(schema.customers)
      .values(makeMockCustomer({ storeId: store.id }))
      .returning();
    [category] = await db
      .insert(schema.categories)
      .values({ name: 'Test Category', description: 'A category for testing' })
      .returning();
    [product] = await db
      .insert(schema.products)
      .values(makeMockProduct({ categoryId: category.id }))
      .returning();
    await db.insert(schema.inventory).values(
      makeMockInventoryItem({
        storeId: store.id,
        productId: product.id,
        totalQuantity: 10,
      })
    );
  });

  afterEach(async () => {
    // Final cleanup to ensure isolation
    await db.delete(schema.transactionItems);
    await db.delete(schema.transactions);
    await db.delete(schema.inventory);
    await db.delete(schema.products);
    await db.delete(schema.categories);
    await db.delete(schema.customers);
    await db.delete(schema.users);
    await db.delete(schema.stores);
  });

  test.integration(
    'should process a sale, update inventory, and record the transaction',
    async () => {
      const transactionParams: CreateTransactionParams = {
        storeId: store.id,
        userId: user.id,
        customerId: customer.id,
        type: TransactionType.SALE,
        paymentMethod: PaymentMethod.CASH,
        subtotal: '20.00',
        tax: '2.00',
        total: '22.00',
        items: [
          {
            productId: product.id,
            quantity: 2,
            unitPrice: '10.00',
          },
        ],
      };

      const createdTransaction = await transactionService.createTransaction(transactionParams);

      // Assert transaction was recorded correctly
      expect(createdTransaction).toBeDefined();
      expect(createdTransaction.id).toBeGreaterThan(0);
      expect(createdTransaction.storeId).toBe(store.id);
      expect(createdTransaction.customerId).toBe(customer.id);
      expect(createdTransaction.totalAmount).toBe('22.00');

      // Assert inventory was decremented
      const updatedInventory = await db.query.inventory.findFirst({
        where: eq(schema.inventory.productId, product.id),
      });
      expect(updatedInventory).toBeDefined();
      expect(updatedInventory?.totalQuantity).toBe(8);
    }
  );
});
