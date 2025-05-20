import { pgTable, serial, integer, text, boolean, timestamp, jsonb, unique, primaryKey, foreignKey, index } from "drizzle-orm/pg-core";
import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

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
  deletedAt: timestamp("deleted_at").nullable(),
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
export const baseRelations = (table: any) => ({
  // Add common relations here
});

export const relations = (table: any) => {
  return baseRelations(table);
};

// Common validation helpers
export const commonValidators = {
  name: (schema: any) => schema.string().min(1, "Name is required"),
  description: (schema: any) => schema.string().optional(),
  status: (schema: any) => schema.enum(["active", "inactive", "deleted"]),
  price: (schema: any) => schema.number().min(0, "Price must be positive"),
  quantity: (schema: any) => schema.number().min(0, "Quantity must be positive"),
  amount: (schema: any) => schema.number().min(0, "Amount must be positive"),
  email: (schema: any) => schema.string().email("Invalid email"),
  phone: (schema: any) => schema.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"),
};

// Type guards
export function isSoftDeleted(record: any): record is SoftDelete {
  return record.deletedAt !== null;
}

export function isActive(record: any): boolean {
  return !isSoftDeleted(record);
}
