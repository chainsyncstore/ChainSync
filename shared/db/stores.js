import { pgTable, text, index } from "drizzle-orm/pg-core";
import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { baseTable } from "./base";
import { relations } from "drizzle-orm";
// Store status enum
export const StoreStatus = {
    ACTIVE: "active",
    INACTIVE: "inactive",
    SUSPENDED: "suspended"
};
export const storeStatusSchema = z.enum([
    StoreStatus.ACTIVE,
    StoreStatus.INACTIVE,
    StoreStatus.SUSPENDED
]);
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
    status: text("status", { enum: ["active", "inactive", "suspended"] })
        .notNull()
        .default(StoreStatus.ACTIVE),
}, (table) => ({
    nameIndex: index("idx_stores_name").on(table.name),
    emailIndex: index("idx_stores_email").on(table.email),
    statusIndex: index("idx_stores_status").on(table.status)
}));
// Validation schemas
export const storeInsertSchema = createInsertSchema(stores)
    .extend({
    name: z.string().min(1, "Name is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    country: z.string().min(1, "Country is required"),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"),
    email: z.string().email("Invalid email"),
    timezone: z.string().min(3, "Timezone is required"),
    status: storeStatusSchema.optional(), // Has a DB default
});
export const storeUpdateSchema = storeInsertSchema.partial();
// Relations
export const storesRelations = relations(stores, () => ({ // `many` removed as it's unused
// These relations will be properly typed when the related tables are imported
// users: many(users),
// inventory: many(inventory),
// transactions: many(transactions),
// loyaltyPrograms: many(loyaltyPrograms),
}));
//# sourceMappingURL=stores.js.map