import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const returnReasons = pgTable("return_reasons", {
  name: text("name").notNull(), // NEW: name column replaces reason
  id: serial("id").primaryKey(),

});
