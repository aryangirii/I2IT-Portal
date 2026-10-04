import { Pool } from "pg";
import { serverConfig } from "@/lib/config";
import { SqlDatabase } from "./database";
const globalDb = globalThis as unknown as {
  placementPool?: Pool;
  placementDatabase?: SqlDatabase;
};
export function database() {
  if (globalDb.placementDatabase) return globalDb.placementDatabase;
  const config = serverConfig();
  const pool =
    globalDb.placementPool ??
    new Pool({
      connectionString: config.DATABASE_URL,
      max: config.DB_POOL_MAX,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      statement_timeout: 15000,
      application_name: "placement-desk",
    });
  pool.on("error", () =>
    console.error(JSON.stringify({ event: "database_pool_error" })),
  );
  globalDb.placementPool = pool;
  globalDb.placementDatabase = new SqlDatabase(pool, async (fn) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
  return globalDb.placementDatabase;
}
