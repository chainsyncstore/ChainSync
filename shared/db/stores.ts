import { pgTable, text, boolean, integer, timestamp, unique, primaryKey, foreignKey, index } from "drizzle-orm/pg-core";
import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { baseTable, timestampsSchema, softDeleteSchema, commonValidators } from "./base";

// Store status
export const storeStatus = z.enum(["active", "inactive", "suspended"]);

// Store table
export const stores = pgTable("stores", {
  ...baseTable,
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  timezone: text("timezone").notNull(),
  status: text("status").notNull().default("active"),
  nameIndex: index("idx_stores_name").on((stores) => stores.name),
  emailIndex: index("idx_stores_email").on((stores) => stores.email),
  statusIndex: index("idx_stores_status").on((stores) => stores.status)
});

// Validation schemas
export const storeInsertSchema = createInsertSchema(stores, {
  name: commonValidators.name,
  address: commonValidators.name,
  city: commonValidators.name,
  state: commonValidators.name,
  country: commonValidators.name,
  phone: commonValidators.phone,
  email: commonValidators.email,
  timezone: (schema) => schema.string().min(3, "Timezone is required"),
  status: (schema) => schema.enum(storeStatus.enum),
});

export const storeUpdateSchema = storeInsertSchema.omit({
  name: true,
  email: true,
});

// Type exports
export type Store = z.infer<typeof createSelectSchema(stores)>;
export type StoreInsert = z.infer<typeof storeInsertSchema>;
export type StoreUpdate = z.infer<typeof storeUpdateSchema>;

// Relations
export const storesRelations = relations(stores, ({ many }) => ({
  users: many(() => users),
  inventory: many(() => inventory),
  transactions: many(() => transactions),
  loyaltyProgram: many(() => loyaltyPrograms),
}));
