import { pgTable, text, varchar, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { baseTable } from './base';

// Suppliers table
export const suppliers = pgTable('suppliers', {
  ...baseTable,
  _name: text('name').notNull(),
  _contactName: text('contact_name'),
  _email: varchar('email', { _length: 255 }).unique(),
  _phone: varchar('phone', { _length: 50 }),
  _address: text('address')
});

// Schemas for suppliers
export const supplierInsertSchema = createInsertSchema(suppliers).extend({
  _name: z.string().min(1, 'Supplier name is required'),
  _contactName: z.string().min(1, 'Contact name must not be empty if provided').optional().nullable(),
  _email: z.string().email('Invalid email format').optional().nullable(),
  _phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional().nullable(),
  _address: z.string().min(1, 'Address must not be empty if provided').optional().nullable()
});
export const supplierSelectSchema = createSelectSchema(suppliers);

// Type exports for suppliers
export type Supplier = z.infer<typeof supplierSelectSchema>;
export type SupplierInsert = z.infer<typeof supplierInsertSchema>;

// Relations for suppliers (e.g., if suppliers have many inventory batches)
export const suppliersRelations = relations(suppliers, ({ many }) => ({
  // _Example: if you want to link back to inventoryBatches
  // _inventoryBatches: many(() => inventoryBatches), // Uncomment and define inventoryBatches if needed here
}));
