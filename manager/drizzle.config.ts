import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL?.trim();
const databaseCredentials = databaseUrl
  ? { dbCredentials: { url: databaseUrl } }
  : {};

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  casing: "snake_case",
  strict: true,
  verbose: true,
  ...databaseCredentials,
});
