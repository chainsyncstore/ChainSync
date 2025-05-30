import { pgTable, serial, integer, decimal, text, timestamp } from "drizzle-orm/pg-core";
import { affiliates } from "./affiliates";

export const referralPayments = pgTable("referral_payments", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").references(() => affiliates.id).notNull(),
  amount: decimal("amount").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
