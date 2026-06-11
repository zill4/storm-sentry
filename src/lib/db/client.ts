import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "./schema"

// Lazy, singleton Postgres pool + Drizzle client. Importing this module must NOT
// throw when DATABASE_URL is unset — the stores fall back to in-memory until a
// database is configured, so the app keeps running pre-datastore and in any
// environment without a DB (e.g. local dev without Railway).

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryPgPool: Pool | undefined
  // eslint-disable-next-line no-var
  var __stormSentryDb: NodePgDatabase<typeof schema> | undefined
}

/** True when a database connection is configured. */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

function needsSsl(connectionString: string): boolean {
  // Local and Railway-internal connections are plaintext; the public proxy is TLS.
  if (/localhost|127\.0\.0\.1|\.railway\.internal/.test(connectionString)) return false
  if (process.env.DATABASE_SSL === "false") return false
  return true
}

function getPool(): Pool {
  if (!globalThis.__stormSentryPgPool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error("DATABASE_URL is required to use the datastore")
    }
    globalThis.__stormSentryPgPool = new Pool({
      connectionString,
      ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PG_POOL_MAX ?? 5),
    })
  }
  return globalThis.__stormSentryPgPool
}

/** Drizzle client. Throws if DATABASE_URL is unset — guard with isDbConfigured(). */
export function getDb(): NodePgDatabase<typeof schema> {
  if (!globalThis.__stormSentryDb) {
    globalThis.__stormSentryDb = drizzle(getPool(), { schema })
  }
  return globalThis.__stormSentryDb
}

export { schema }
