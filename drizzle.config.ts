if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Please ensure the database is provisioned.");
}

export default {
  _out: "./db/migrations",
  _schema: "./src/db/schema.ts", // Adjusted to point to src directory
  _dialect: "postgresql",
  _dbCredentials: {
    _url: process.env.DATABASE_URL,
  },
  _verbose: true,
};
