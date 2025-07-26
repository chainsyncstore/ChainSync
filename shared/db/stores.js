"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storesRelations = exports.storeUpdateSchema = exports.storeInsertSchema = exports.stores = exports.storeStatusSchema = exports.StoreStatus = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const zod_1 = require("zod");
const drizzle_zod_1 = require("drizzle-zod");
const base_1 = require("./base");
const drizzle_orm_1 = require("drizzle-orm");
// Store status enum
exports.StoreStatus = {
    ACTIVE: "active",
    INACTIVE: "inactive",
    SUSPENDED: "suspended"
};
exports.storeStatusSchema = zod_1.z.enum([
    exports.StoreStatus.ACTIVE,
    exports.StoreStatus.INACTIVE,
    exports.StoreStatus.SUSPENDED
]);
// Store table
exports.stores = (0, pg_core_1.pgTable)("stores", {
    ...base_1.baseTable,
    name: (0, pg_core_1.text)("name").notNull(),
    address: (0, pg_core_1.text)("address").notNull(),
    city: (0, pg_core_1.text)("city").notNull(),
    state: (0, pg_core_1.text)("state").notNull(),
    country: (0, pg_core_1.text)("country").notNull(),
    phone: (0, pg_core_1.text)("phone").notNull(),
    email: (0, pg_core_1.text)("email").notNull(),
    timezone: (0, pg_core_1.text)("timezone").notNull(),
    status: (0, pg_core_1.text)("status", { enum: ["active", "inactive", "suspended"] })
        .notNull()
        .default(exports.StoreStatus.ACTIVE),
}, (table) => ({
    nameIndex: (0, pg_core_1.index)("idx_stores_name").on(table.name),
    emailIndex: (0, pg_core_1.index)("idx_stores_email").on(table.email),
    statusIndex: (0, pg_core_1.index)("idx_stores_status").on(table.status)
}));
// Validation schemas
exports.storeInsertSchema = (0, drizzle_zod_1.createInsertSchema)(exports.stores)
    .extend({
    name: zod_1.z.string().min(1, "Name is required"),
    address: zod_1.z.string().min(1, "Address is required"),
    city: zod_1.z.string().min(1, "City is required"),
    state: zod_1.z.string().min(1, "State is required"),
    country: zod_1.z.string().min(1, "Country is required"),
    phone: zod_1.z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"),
    email: zod_1.z.string().email("Invalid email"),
    timezone: zod_1.z.string().min(3, "Timezone is required"),
    status: exports.storeStatusSchema.optional(), // Has a DB default
});
exports.storeUpdateSchema = exports.storeInsertSchema.partial();
// Relations
exports.storesRelations = (0, drizzle_orm_1.relations)(exports.stores, ({ many }) => ({
// These relations will be properly typed when the related tables are imported
// users: many(users),
// inventory: many(inventory),
// transactions: many(transactions),
// loyaltyPrograms: many(loyaltyPrograms),
}));
