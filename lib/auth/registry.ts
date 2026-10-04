import { createHash, randomBytes } from "node:crypto";
import type { Database } from "@/lib/db/database";
export const SESSION_SECONDS = 2 * 60 * 60;
function digest(id: string) {
  return createHash("sha256").update(id).digest("hex");
}
export async function createSession(db: Database, email: string) {
  const id = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  // Lock the student row against concurrent suspension while issuing a session.
  await db.batch(
    [
      db
        .prepare("SELECT crn FROM students WHERE email=? FOR UPDATE")
        .bind(email),
      db
        .prepare(
          "INSERT INTO auth_sessions(token_hash,email,expires_at) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM students WHERE email=? AND blocked=1) RETURNING token_hash",
        )
        .bind(digest(id), email, expires, email),
    ],
    (results) => {
      if (results[1].results.length !== 1)
        throw new Error("Account unavailable");
    },
  );
  return id;
}
export async function sessionIdentity(
  db: Database,
  id: unknown,
  email: unknown,
) {
  if (
    typeof id !== "string" ||
    !/^[a-f0-9]{64}$/.test(id) ||
    typeof email !== "string"
  )
    return null;
  const record = await db
    .prepare(
      "SELECT a.email,a.expires_at FROM auth_sessions a WHERE a.token_hash=? AND a.email=? AND a.revoked_at IS NULL AND a.expires_at>CURRENT_TIMESTAMP AND NOT EXISTS (SELECT 1 FROM students s WHERE s.email=a.email AND s.blocked=1)",
    )
    .bind(digest(id), email)
    .first<{ email: string; expires_at: Date | string }>();
  return record;
}
export async function revokeSession(db: Database, id: unknown) {
  if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id)) return;
  await db
    .prepare(
      "UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=? AND revoked_at IS NULL",
    )
    .bind(digest(id))
    .run();
}
