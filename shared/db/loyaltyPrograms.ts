import { pgTable, serial, text, integer, timestamp, decimal } from "drizzle-orm/pg-core";
import { stores } from "./stores";

export const loyaltyPrograms = pgTable("loyalty_programs", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  pointsPerCurrency: decimal("points_per_currency").notNull().default("1.00"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type NewLoyaltyProgram = typeof loyaltyPrograms.$inferInsert;
