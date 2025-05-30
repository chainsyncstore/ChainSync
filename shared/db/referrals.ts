import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { affiliates } from "./affiliates";
import { users } from "./users";

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").references(() => affiliates.id).notNull(),
  referredUserId: integer("referred_user_id").references(() => users.id),
  status: text("status").notNull(),
  signupDate: timestamp("signup_date"),
  activationDate: timestamp("activation_date"),
  expiryDate: timestamp("expiry_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
