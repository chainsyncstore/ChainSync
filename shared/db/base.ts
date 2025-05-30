import { pgTable, serial, integer, text, boolean, timestamp, jsonb, unique, primaryKey, foreignKey, index } from "drizzle-orm/pg-core";
import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations as drizzleRelations } from "drizzle-orm";

// Base types
export type Timestamps = {
  createdAt: Date;
  updatedAt: Date;
};

export type SoftDelete = {
  deletedAt?: Date | null;
};

// Base table configuration
export const baseTable = {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
};

// Timestamps schema
export const timestampsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Soft delete schema
export const softDeleteSchema = z.object({
  deletedAt: z.date().nullable(),
});

// Base validation schemas
export const baseInsertSchema = timestampsSchema.merge(softDeleteSchema);
export const baseSelectSchema = timestampsSchema.merge(softDeleteSchema);

// Base relations
export const baseRelations = (table: unknown) => ({
  // Add common relations here
});

export const defineRelations = (table: unknown) => {
  return baseRelations(table);
};

// Common validation helpers
export const commonValidators = {
  name: (schema: unknown) => schema.string().min(1, "Name is required"),
  description: (schema: unknown) => schema.string().optional(),
  status: (schema: unknown) => schema.enum(["active", "inactive", "deleted"]),
  price: (schema: unknown) => schema.number().min(0, "Price must be positive"),
  quantity: (schema: unknown) => schema.number().min(0, "Quantity must be positive"),
  amount: (schema: unknown) => schema.number().min(0, "Amount must be positive"),
  email: (schema: unknown) => schema.string().email("Invalid email"),
  phone: (schema: unknown) => schema.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"),
};

// Type guards
export function isSoftDeleted(record: unknown): record is SoftDelete {
  return record.deletedAt !== null;
}

export function isActive(record: unknown): boolean {
  return !isSoftDeleted(record);
}
