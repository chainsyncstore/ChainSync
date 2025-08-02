import { pgTable, serial, integer, text, boolean, timestamp, jsonb, unique, primaryKey, foreignKey, index } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations as drizzleRelations } from 'drizzle-orm';

// Base types
export type Timestamps = {
  _createdAt: Date;
  _updatedAt: Date;
};

export type SoftDelete = {
  deletedAt?: Date | null;
};

// Base table configuration
export const baseTable = {
  _id: serial('id').primaryKey(),
  _createdAt: timestamp('created_at').defaultNow().notNull(),
  _updatedAt: timestamp('updated_at').defaultNow().notNull(),
  _deletedAt: timestamp('deleted_at')
};

// Timestamps schema
export const timestampsSchema = z.object({
  _createdAt: z.date(),
  _updatedAt: z.date()
});

// Soft delete schema
export const softDeleteSchema = z.object({
  _deletedAt: z.date().nullable()
});

// Base validation schemas
export const baseInsertSchema = timestampsSchema.merge(softDeleteSchema);
export const baseSelectSchema = timestampsSchema.merge(softDeleteSchema);

// Base relations
export const baseRelations = (_table: any) => ({
  // Add common relations here
});

export const defineRelations = (_table: any) => {
  return baseRelations(table);
};

// Common validation helpers
export const commonValidators = {
  _name: (_schema: any) => schema.string().min(1, 'Name is required'),
  _description: (_schema: any) => schema.string().optional(),
  _status: (_schema: any) => schema.enum(['active', 'inactive', 'deleted']),
  _price: (_schema: any) => schema.number().min(0, 'Price must be positive'),
  _quantity: (_schema: any) => schema.number().min(0, 'Quantity must be positive'),
  _amount: (_schema: any) => schema.number().min(0, 'Amount must be positive'),
  _email: (_schema: any) => schema.string().email('Invalid email'),
  _phone: (_schema: any) => schema.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number')
};

// Type guards
export function isSoftDeleted(_record: any): record is SoftDelete {
  return record.deletedAt !== null;
}

export function isActive(_record: any): boolean {
  return !isSoftDeleted(record);
}
