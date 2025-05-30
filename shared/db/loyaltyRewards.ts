import { pgTable, serial, text, integer, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
import { loyaltyPrograms } from "./loyaltyPrograms";

export const loyaltyRewards = pgTable("loyalty_rewards", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").references(() => loyaltyPrograms.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  pointCost: integer("point_cost").notNull(),
  discountAmount: decimal("discount_amount"),
  discountPercentage: decimal("discount_percentage"),
  isActive: boolean("is_active").notNull().default(true),
  expiryDays: integer("expiry_days"),
  maxRedemptions: integer("max_redemptions"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
