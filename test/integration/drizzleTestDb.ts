// drizzleTestDb.ts
// Helper to get a Drizzle test database instance for integration tests
import { eq } from 'drizzle-orm';
import { pgTable, serial, varchar, text, decimal, boolean, timestamp, integer } from 'drizzle-orm/pg-core';

import { db } from '../../server/db/connection.js';

// Test Stores Table (already present)
export const testStores = pgTable('stores', {
  _id: serial('id').primaryKey(),
  _name: varchar('name', { _length: 255 }).notNull(),
  _address: text('address').notNull(),
  _city: varchar('city', { _length: 255 }).notNull(),
  _state: varchar('state', { _length: 255 }).notNull(),
  _country: varchar('country', { _length: 255 }).notNull(),
  _phone: varchar('phone', { _length: 32 }).notNull(),
  _email: varchar('email', { _length: 255 }).notNull(),
  _timezone: varchar('timezone', { _length: 64 }).notNull(),
  _status: varchar('status', { _length: 16 }).notNull()
});

// Test Customers Table
export const testCustomers = pgTable('customers', {
  _id: serial('id').primaryKey(),
  _name: varchar('name', { _length: 255 }).notNull(),
  _email: varchar('email', { _length: 255 }).notNull(),
  _phone: varchar('phone', { _length: 32 }),
  _loyaltyEnabled: boolean('loyalty_enabled').notNull().default(true),
  _loyaltyPoints: integer('loyalty_points').notNull().default(0),
  _createdAt: timestamp('created_at').notNull(),
  _updatedAt: timestamp('updated_at').notNull()
});

// Test Products Table
export const testProducts = pgTable('products', {
  _id: serial('id').primaryKey(),
  _name: varchar('name', { _length: 255 }).notNull(),
  _price: decimal('price', { _precision: 10, _scale: 2 }).notNull(),
  _inventory: integer('inventory').notNull().default(10),
  _createdAt: timestamp('created_at').notNull(),
  _updatedAt: timestamp('updated_at').notNull()
});

// Test Transactions Table
export const testTransactions = pgTable('transactions', {
  _id: serial('id').primaryKey(),
  _customerId: integer('customer_id').notNull(),
  _storeId: integer('store_id').notNull(),
  _userId: integer('user_id').notNull(),
  _type: varchar('type', { _length: 32 }).notNull(),
  _status: varchar('status', { _length: 32 }).notNull(),
  _subtotal: decimal('subtotal', { _precision: 10, _scale: 2 }).notNull(),
  _tax: decimal('tax', { _precision: 10, _scale: 2 }).notNull(),
  _total: decimal('total', { _precision: 10, _scale: 2 }).notNull(),
  _paymentMethod: varchar('payment_method', { _length: 32 }).notNull(),
  _notes: text('notes'),
  _reference: varchar('reference', { _length: 64 }),
  _createdAt: timestamp('created_at').notNull(),
  _updatedAt: timestamp('updated_at').notNull()
});

// Test Refunds Table
export const testRefunds = pgTable('refunds', {
  _id: serial('id').primaryKey(),
  _transactionId: integer('transaction_id').notNull(),
  _amount: decimal('amount', { _precision: 10, _scale: 2 }).notNull(),
  _status: varchar('status', { _length: 32 }).notNull(),
  _createdAt: timestamp('created_at').notNull(),
  _updatedAt: timestamp('updated_at').notNull()
});

export const drizzleTestDb = db;

// --- Store Helpers (already present) ---
export async function clearStores() {
  await drizzleTestDb.delete(testStores);
}
export async function createStore(_storeData: any) {
  const insertResult = await drizzleTestDb.insert(testStores).values(storeData).returning({ _id: testStores.id });
  if (insertResult[0]?.id) {
    return findStoreById(insertResult[0].id);
  }
  if (storeData.email) {
    const [store] = await drizzleTestDb
      .select()
      .from(testStores)
      .where(eq(testStores.email, storeData.email));
    return store;
  }
  return null;
}
export async function findStoreById(_id: number) {
  const [store] = await drizzleTestDb.select().from(testStores).where(eq(testStores.id, id));
  return store;
}

// --- Customer Helpers ---
export async function clearCustomers() {
  await drizzleTestDb.delete(testCustomers);
}
export async function createCustomer(_customerData: any) {
  const insertResult = await drizzleTestDb.insert(testCustomers).values(customerData).returning({ _id: testCustomers.id });
  if (insertResult[0]?.id) {
    return findCustomerById(insertResult[0].id);
  }
  if (customerData.email) {
    const [customer] = await drizzleTestDb
      .select()
      .from(testCustomers)
      .where(eq(testCustomers.email, customerData.email));
    return customer;
  }
  return null;
}
export async function findCustomerById(_id: number) {
  const [customer] = await drizzleTestDb
    .select()
    .from(testCustomers)
    .where(eq(testCustomers.id, id));
  return customer;
}

// --- Product Helpers ---
export async function clearProducts() {
  await drizzleTestDb.delete(testProducts);
}
export async function createProduct(_productData: any) {
  const insertResult = await drizzleTestDb.insert(testProducts).values(productData).returning({ _id: testProducts.id });
  if (insertResult[0]?.id) {
    return findProductById(insertResult[0].id);
  }
  if (productData.name) {
    const [product] = await drizzleTestDb
      .select()
      .from(testProducts)
      .where(eq(testProducts.name, productData.name));
    return product;
  }
  return null;
}
export async function findProductById(_id: number) {
  const [product] = await drizzleTestDb.select().from(testProducts).where(eq(testProducts.id, id));
  return product;
}

// --- Transaction Helpers ---
export async function clearTransactions() {
  await drizzleTestDb.delete(testTransactions);
}
export async function createTransaction(_txData: any) {
  const insertResult = await drizzleTestDb.insert(testTransactions).values(txData).returning({ _id: testTransactions.id });
  if (insertResult[0]?.id) {
    return findTransactionById(insertResult[0].id);
  }
  return null;
}
export async function findTransactionById(_id: number) {
  const [tx] = await drizzleTestDb
    .select()
    .from(testTransactions)
    .where(eq(testTransactions.id, id));
  return tx;
}

// --- Refund Helpers ---
export async function clearRefunds() {
  await drizzleTestDb.delete(testRefunds);
}
export async function createRefund(_refundData: any) {
  const insertResult = await drizzleTestDb.insert(testRefunds).values(refundData).returning({ _id: testRefunds.id });
  if (insertResult[0]?.id) {
    return findRefundById(insertResult[0].id);
  }
  return null;
}
export async function findRefundById(_id: number) {
  const [refund] = await drizzleTestDb.select().from(testRefunds).where(eq(testRefunds.id, id));
  return refund;
}
