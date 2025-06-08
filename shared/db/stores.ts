import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

import { baseTable } from './base';

// Store status enum
export const StoreStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const;

export type StoreStatus = (typeof StoreStatus)[keyof typeof StoreStatus];

export const storeStatusSchema = z.enum([
  StoreStatus.ACTIVE,
  StoreStatus.INACTIVE,
  StoreStatus.SUSPENDED,
]);

// Store table
export const stores = pgTable(
  'stores',
  {
    ...baseTable,
    name: text('name').notNull(),
    address: text('address').notNull(),
    city: text('city').notNull(),
    state: text('state').notNull(),
    country: text('country').notNull(),
    phone: text('phone').notNull(),
    email: text('email').notNull(),
    timezone: text('timezone').notNull(),
    status: text('status', { enum: ['active', 'inactive', 'suspended'] as const })
      .notNull()
      .default(StoreStatus.ACTIVE),
  },
  table => ({
    nameIndex: index('idx_stores_name').on(table.name),
    emailIndex: index('idx_stores_email').on(table.email),
    statusIndex: index('idx_stores_status').on(table.status),
  })
);

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;

// Validation schemas
export const storeInsertSchema = createInsertSchema(stores, {
  name: schema => schema.min(1, 'Name is required'),
  address: schema => schema.min(1, 'Address is required'),
  city: schema => schema.min(1, 'City is required'),
  state: schema => schema.min(1, 'State is required'),
  country: schema => schema.min(1, 'Country is required'),
  phone: schema => schema.regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
  email: schema => schema.email('Invalid email'),
  timezone: schema => schema.min(3, 'Timezone is required'),
  status: schema => schema.optional(), // Has a DB default
});

export const storeUpdateSchema = storeInsertSchema.partial();

// Relations
export const storesRelations = relations(stores, ({ many }) => ({
  // These relations will be properly typed when the related tables are imported
  // users: many(users),
  // inventory: many(inventory),
  // transactions: many(transactions),
  // loyaltyPrograms: many(loyaltyPrograms),
}));
