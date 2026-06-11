import { defineConfig } from "drizzle-kit"

// `db:generate` builds migration SQL from the schema (no DB needed).
// `db:migrate` / `db:push` require DATABASE_URL (Railway Postgres public URL
// when running locally; the internal URL inside Railway).
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
})
