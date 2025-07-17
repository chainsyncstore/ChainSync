import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { baseTable } from "./base";
// Suppliers table
export const suppliers = pgTable("suppliers", {
    ...baseTable,
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: varchar("email", { length: 255 }).unique(),
    phone: varchar("phone", { length: 50 }),
    address: text("address"),
});
// Schemas for suppliers
export const supplierInsertSchema = createInsertSchema(suppliers).extend({
    name: z.string().min(1, "Supplier name is required"),
    contactName: z.string().min(1, "Contact name must not be empty if provided").optional().nullable(),
    email: z.string().email("Invalid email format").optional().nullable(),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format").optional().nullable(),
    address: z.string().min(1, "Address must not be empty if provided").optional().nullable(),
});
export const supplierSelectSchema = createSelectSchema(suppliers);
// Relations for suppliers (e.g., if suppliers have many inventory batches)
export const suppliersRelations = relations(suppliers, () => ({ // `many` removed as it's unused
// Example: if you want to link back to inventoryBatches
// inventoryBatches: many(() => inventoryBatches), // Uncomment and define inventoryBatches if needed here
}));
//# sourceMappingURL=suppliers.js.map