import { pgTable, serial, integer, text, decimal, timestamp } from "drizzle-orm/pg-core";
import { stores } from "./stores";
import { users } from "./users";

export const returns = pgTable("returns", {
  total: decimal("total").notNull(), // NEW: total column
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  totalAmount: decimal("total_amount").notNull(),
  reasonId: integer("reason_id"),
  refundId: integer("refund_id"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
