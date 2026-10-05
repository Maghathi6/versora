import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { env } from '../config/env';
import * as schema from './schema';

let pool: Pool | null = null;
let dbInstance: NodePgDatabase<typeof schema> | null = null;

/**
 * Initializes and returns the PostgreSQL connection pool.
 */
export function getPool(): Pool {
  if (!pool) {
    if (!env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is not configured. Please define DATABASE_URL in your backend .env file.'
      );
    }
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

/**
 * Returns the typed Drizzle ORM database instance.
 */
export function getDb(): NodePgDatabase<typeof schema> {
  if (!dbInstance) {
    const connectionPool = getPool();
    dbInstance = drizzle(connectionPool, { schema });
  }
  return dbInstance;
}

/**
 * Tests database connectivity by executing a lightweight ping query.
 */
export async function checkDatabaseConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const connectionPool = getPool();
    const client = await connectionPool.connect();
    try {
      await client.query('SELECT 1');
      return { ok: true };
    } finally {
      client.release();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// Default exported db proxy that calls getDb() lazily
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    const instance = getDb();
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export * from './schema';
