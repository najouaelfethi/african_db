import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

export const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : null;

export const db = pool ? drizzle(pool, { schema }) : null;

export function assertDb() {
  if (!db) {
    throw new Error(
      "DATABASE_URL is not configured. Contact request persistence is unavailable until the backend database is provisioned.",
    );
  }

  return db;
}

export * from "./schema";
