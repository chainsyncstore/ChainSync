// test/types.d.ts
// Globally available types for tests
import type { Product, Transaction, Customer, Store, Inventory } from '@prisma/client';
import type { DeepMockProxy } from 'jest-mock-extended';
import type { PrismaClient } from '@prisma/client';

// Type aliases for common mock types
export type MockProduct = Product;
export type MockTransaction = Transaction;
export type MockCustomer = Customer;
export type MockStore = Store;
export type MockInventoryItem = Inventory;
export type MockDb = DeepMockProxy<PrismaClient>;
