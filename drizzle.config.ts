import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Please ensure the database is provisioned.");
}

export default defineConfig({
  out: "./db/migrations",
  schema: "./src/db/schema.ts", // Adjusted to point to src directory
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
});
