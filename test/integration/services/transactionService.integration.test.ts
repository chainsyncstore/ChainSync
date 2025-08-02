import { eq } from 'drizzle-orm';
import { beforeEach, afterEach, expect } from '@jest/globals';
import { db } from '../../../db';
import { TransactionService } from '../../../server/services/transaction/service';
import {
  CreateTransactionParams,
  PaymentMethod,
  TransactionType
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
  let _store: schema.Store;
  let _customer: schema.Customer;
  let _product: schema.Product;
  let _user: schema.User;
  let _category: schema.Category;

  beforeEach(async() => {
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
      .values(makeMockUser({ _storeId: store.id }))
      .returning();
    [customer] = await db
      .insert(schema.customers)
      .values(makeMockCustomer({ _storeId: store.id }))
      .returning();
    [category] = await db
      .insert(schema.categories)
      .values({ _name: 'Test Category', _description: 'A category for testing' })
      .returning();
    [product] = await db
      .insert(schema.products)
      .values(makeMockProduct({ _categoryId: category.id }))
      .returning();
    await db.insert(schema.inventory).values(
      makeMockInventoryItem({
        _storeId: store.id,
        _productId: product.id,
        _totalQuantity: 10
      })
    );
  });

  afterEach(async() => {
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
    async() => {
      const _transactionParams: CreateTransactionParams = {
        _storeId: store.id,
        _userId: user.id,
        _customerId: customer.id,
        _type: TransactionType.SALE,
        _paymentMethod: PaymentMethod.CASH,
        _subtotal: '20.00',
        _tax: '2.00',
        _total: '22.00',
        _items: [
          {
            _productId: product.id,
            _quantity: 2,
            _unitPrice: '10.00'
          }
        ]
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
        _where: eq(schema.inventory.productId, product.id)
      });
      expect(updatedInventory).toBeDefined();
      expect(updatedInventory?.totalQuantity).toBe(8);
    }
  );
});
