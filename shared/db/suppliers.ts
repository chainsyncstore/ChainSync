import { relations } from 'drizzle-orm';
import { pgTable, text, varchar, serial } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { baseTable } from './base.js';

// Suppliers table
export const suppliers = pgTable('suppliers', {
  ...baseTable,
  name: text('name').notNull(),
  contactName: text('contact_name'),
  email: varchar('email', { length: 255 }).unique(),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
});

// Schemas for suppliers
export const supplierInsertSchema = createInsertSchema(suppliers, {
  name: schema => schema.min(1, 'Supplier name is required'),
  contactName: schema =>
    schema.min(1, 'Contact name must not be empty if provided').optional().nullable(),
  email: schema => schema.email('Invalid email format').optional().nullable(),
  phone: schema =>
    schema
      .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
      .optional()
      .nullable(),
  address: schema => schema.min(1, 'Address must not be empty if provided').optional().nullable(),
});
export const supplierSelectSchema = createSelectSchema(suppliers);

// Type exports for suppliers
export type Supplier = z.infer<typeof supplierSelectSchema>;
export type SupplierInsert = z.infer<typeof supplierInsertSchema>;

// Relations for suppliers (e.g., if suppliers have many inventory batches)
export const suppliersRelations = relations(suppliers, ({ many }) => ({
  // Example: if you want to link back to inventoryBatches
  // inventoryBatches: many(() => inventoryBatches), // Uncomment and define inventoryBatches if needed here
}));
