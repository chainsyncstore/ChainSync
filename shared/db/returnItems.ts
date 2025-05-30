import { pgTable, serial, integer, decimal, text, boolean } from "drizzle-orm/pg-core";

export const returnItems = pgTable("return_items", {
  returnReasonId: integer("return_reason_id"), // NEW: returnReasonId column
  refundId: integer("refund_id"), // NEW: refundId column
  isRestocked: boolean("is_restocked").notNull().default(false), // NEW: isRestocked column
  id: serial("id").primaryKey(),
  returnId: integer("return_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  amount: decimal("amount").notNull(),
  reasonId: integer("reason_id"),
  notes: text("notes"),
});
