import { pgTable, serial, integer, decimal, text, timestamp } from "drizzle-orm/pg-core";
import { affiliates } from "./affiliates";

export const referralPayments = pgTable("referral_payments", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").references(() => affiliates.id).notNull(),
  amount: decimal("amount").notNull(), // Storing as decimal for precision
  status: text("status").notNull(), // e.g., 'pending', 'completed', 'failed'
  paymentMethod: text("payment_method"), // Added based on usage in affiliate service
  transactionReference: text("transaction_reference"), // Added based on usage
  paymentDate: timestamp("payment_date"), // Added based on usage
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(), // Added updatedAt
});
