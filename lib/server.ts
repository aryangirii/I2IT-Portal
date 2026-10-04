import type { Database, PreparedStatement } from "@/lib/db/database";
import { currentActor } from "@/lib/auth/session";
export { database } from "@/lib/db/postgres";
export async function actor() {
  const user = await currentActor();
  if (!user) throw new HttpError(401, "Sign in to continue.");
  return user;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const now = () => new Date().toISOString();
export function auditStatement(
  db: Database,
  email: string,
  action: string,
  detail: string,
) {
  return db
    .prepare("INSERT INTO audit (id,actor,action,detail,at) VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(), email, action, detail, now());
}
// A single transaction prevents partially applied roster and attendance imports.
export async function batches(db: Database, statements: PreparedStatement[]) {
  await db.batch(statements);
}
