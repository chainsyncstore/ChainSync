"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suppliersRelations = exports.supplierSelectSchema = exports.supplierInsertSchema = exports.suppliers = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const zod_1 = require("zod");
const drizzle_zod_1 = require("drizzle-zod");
const base_1 = require("./base");
// Suppliers table
exports.suppliers = (0, pg_core_1.pgTable)("suppliers", {
    ...base_1.baseTable,
    name: (0, pg_core_1.text)("name").notNull(),
    contactName: (0, pg_core_1.text)("contact_name"),
    email: (0, pg_core_1.varchar)("email", { length: 255 }).unique(),
    phone: (0, pg_core_1.varchar)("phone", { length: 50 }),
    address: (0, pg_core_1.text)("address"),
});
// Schemas for suppliers
exports.supplierInsertSchema = (0, drizzle_zod_1.createInsertSchema)(exports.suppliers).extend({
    name: zod_1.z.string().min(1, "Supplier name is required"),
    contactName: zod_1.z.string().min(1, "Contact name must not be empty if provided").optional().nullable(),
    email: zod_1.z.string().email("Invalid email format").optional().nullable(),
    phone: zod_1.z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format").optional().nullable(),
    address: zod_1.z.string().min(1, "Address must not be empty if provided").optional().nullable(),
});
exports.supplierSelectSchema = (0, drizzle_zod_1.createSelectSchema)(exports.suppliers);
// Relations for suppliers (e.g., if suppliers have many inventory batches)
exports.suppliersRelations = (0, drizzle_orm_1.relations)(exports.suppliers, ({ many }) => ({
// Example: if you want to link back to inventoryBatches
// inventoryBatches: many(() => inventoryBatches), // Uncomment and define inventoryBatches if needed here
}));
