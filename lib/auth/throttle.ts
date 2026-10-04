import type { Database } from "@/lib/db/database";
// The shared bucket is intentionally limited to the loopback-only demo provider.
// Production OAuth requires a deployment-level limiter with a trusted client IP.
export async function demoAttemptAllowed(db: Database) {
  const result = await db
    .prepare(
      "INSERT INTO rate_limits(identity,action,window_id,count) VALUES('local-demo','authenticate',?,1) ON CONFLICT(identity,action) DO UPDATE SET window_id=excluded.window_id,count=CASE WHEN rate_limits.window_id=excluded.window_id THEN rate_limits.count+1 ELSE 1 END RETURNING count",
    )
    .bind(Math.floor(Date.now() / 60000))
    .first<{ count: number }>();
  return Boolean(result && result.count <= 20);
}
