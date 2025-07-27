import { serial, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";
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
export const baseRelations = (table) => ({
// Add common relations here
});
export const defineRelations = (table) => {
    return baseRelations(table);
};
// Common validation helpers
export const commonValidators = {
    name: (schema) => schema.string().min(1, "Name is required"),
    description: (schema) => schema.string().optional(),
    status: (schema) => schema.enum(["active", "inactive", "deleted"]),
    price: (schema) => schema.number().min(0, "Price must be positive"),
    quantity: (schema) => schema.number().min(0, "Quantity must be positive"),
    amount: (schema) => schema.number().min(0, "Amount must be positive"),
    email: (schema) => schema.string().email("Invalid email"),
    phone: (schema) => schema.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"),
};
// Type guards
export function isSoftDeleted(record) {
    return record.deletedAt !== null;
}
export function isActive(record) {
    return !isSoftDeleted(record);
}
