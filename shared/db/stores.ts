import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { createInsertSchema } from 'drizzle-zod';
import { baseTable } from './base';
import { relations } from 'drizzle-orm';

// Store status enum
export const StoreStatus = {
  _ACTIVE: 'active',
  _INACTIVE: 'inactive',
  _SUSPENDED: 'suspended'
} as const;

export type StoreStatus = typeof StoreStatus[keyof typeof StoreStatus];

export const storeStatusSchema = z.enum([
  StoreStatus.ACTIVE,
  StoreStatus.INACTIVE,
  StoreStatus.SUSPENDED
]);

// Store table
export const stores = pgTable('stores', {
  ...baseTable,
  _name: text('name').notNull(),
  _address: text('address').notNull(),
  _city: text('city').notNull(),
  _state: text('state').notNull(),
  _country: text('country').notNull(),
  _phone: text('phone').notNull(),
  _email: text('email').notNull(),
  _timezone: text('timezone').notNull(),
  _status: text('status', { _enum: ['active', 'inactive', 'suspended'] as const })
    .notNull()
    .default(StoreStatus.ACTIVE)
}, (table) => ({
  _nameIndex: index('idx_stores_name').on(table.name),
  _emailIndex: index('idx_stores_email').on(table.email),
  _statusIndex: index('idx_stores_status').on(table.status)
}));

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;

// Validation schemas
export const storeInsertSchema = createInsertSchema(stores)
  .extend({
    _name: z.string().min(1, 'Name is required'),
    _address: z.string().min(1, 'Address is required'),
    _city: z.string().min(1, 'City is required'),
    _state: z.string().min(1, 'State is required'),
    _country: z.string().min(1, 'Country is required'),
    _phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
    _email: z.string().email('Invalid email'),
    _timezone: z.string().min(3, 'Timezone is required'),
    _status: storeStatusSchema.optional() // Has a DB default
  });

export const storeUpdateSchema = storeInsertSchema.partial();

// Relations
export const storesRelations = relations(stores, ({ many }) => ({
  // These relations will be properly typed when the related tables are imported
  // _users: many(users),
  // _inventory: many(inventory),
  // _transactions: many(transactions),
  // _loyaltyPrograms: many(loyaltyPrograms),
}));
