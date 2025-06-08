// drizzleTestDb.ts
// Helper to get a Drizzle test database instance for integration tests
import { db } from '../../server/db/connection';
import { mysqlTable, int, varchar, text, decimal, boolean, datetime } from 'drizzle-orm/mysql-core';
import { eq } from 'drizzle-orm';

// Test Stores Table (already present)
export const testStores = mysqlTable('stores', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address').notNull(),
  city: varchar('city', { length: 255 }).notNull(),
  state: varchar('state', { length: 255 }).notNull(),
  country: varchar('country', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 32 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  timezone: varchar('timezone', { length: 64 }).notNull(),
  status: varchar('status', { length: 16 }).notNull(),
});

// Test Customers Table
export const testCustomers = mysqlTable('customers', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 32 }),
  loyaltyEnabled: boolean('loyalty_enabled').notNull().default(true),
  loyaltyPoints: int('loyalty_points').notNull().default(0),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// Test Products Table
export const testProducts = mysqlTable('products', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  inventory: int('inventory').notNull().default(10),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// Test Transactions Table
export const testTransactions = mysqlTable('transactions', {
  id: int('id').primaryKey().autoincrement(),
  customerId: int('customer_id').notNull(),
  storeId: int('store_id').notNull(),
  userId: int('user_id').notNull(),
  type: varchar('type', { length: 32 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  tax: decimal('tax', { precision: 10, scale: 2 }).notNull(),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 32 }).notNull(),
  notes: text('notes'),
  reference: varchar('reference', { length: 64 }),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// Test Refunds Table
export const testRefunds = mysqlTable('refunds', {
  id: int('id').primaryKey().autoincrement(),
  transactionId: int('transaction_id').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

export const drizzleTestDb = db;

// --- Store Helpers (already present) ---
export async function clearStores() {
  await drizzleTestDb.delete(testStores);
}
export async function createStore(storeData: any) {
  const insertResult = await drizzleTestDb.insert(testStores).values(storeData);
  if ('insertId' in insertResult && insertResult.insertId) {
    return findStoreById(insertResult.insertId);
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
export async function findStoreById(id: number) {
  const [store] = await drizzleTestDb.select().from(testStores).where(eq(testStores.id, id));
  return store;
}

// --- Customer Helpers ---
export async function clearCustomers() {
  await drizzleTestDb.delete(testCustomers);
}
export async function createCustomer(customerData: any) {
  const insertResult = await drizzleTestDb.insert(testCustomers).values(customerData);
  if ('insertId' in insertResult && insertResult.insertId) {
    return findCustomerById(insertResult.insertId);
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
export async function findCustomerById(id: number) {
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
export async function createProduct(productData: any) {
  const insertResult = await drizzleTestDb.insert(testProducts).values(productData);
  if ('insertId' in insertResult && insertResult.insertId) {
    return findProductById(insertResult.insertId);
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
export async function findProductById(id: number) {
  const [product] = await drizzleTestDb.select().from(testProducts).where(eq(testProducts.id, id));
  return product;
}

// --- Transaction Helpers ---
export async function clearTransactions() {
  await drizzleTestDb.delete(testTransactions);
}
export async function createTransaction(txData: any) {
  const insertResult = await drizzleTestDb.insert(testTransactions).values(txData);
  if ('insertId' in insertResult && insertResult.insertId) {
    return findTransactionById(insertResult.insertId);
  }
  return null;
}
export async function findTransactionById(id: number) {
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
export async function createRefund(refundData: any) {
  const insertResult = await drizzleTestDb.insert(testRefunds).values(refundData);
  if ('insertId' in insertResult && insertResult.insertId) {
    return findRefundById(insertResult.insertId);
  }
  return null;
}
export async function findRefundById(id: number) {
  const [refund] = await drizzleTestDb.select().from(testRefunds).where(eq(testRefunds.id, id));
  return refund;
}
