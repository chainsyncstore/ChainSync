import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Please ensure the database is provisioned.");
}

export default defineConfig({
  out: "./db/migrations",
  schema: "./shared/schema.ts", // Point to the correct schema location
  driver: "pg", // Specify the node-postgres driver
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  verbose: true,
});
