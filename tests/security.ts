import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fixture } from "./fixtures";
import {
  createSession,
  sessionIdentity,
  revokeSession,
} from "../lib/auth/registry";
import { authOptions } from "../lib/auth/options";
import { demoAttemptAllowed } from "../lib/auth/throttle";
const f = await fixture(2);
assert.equal(
  (await f.request("import_roster", { body: { csv: f.csv, confirm: true } }))
    .status,
  200,
);
const results: { name: string; status: string }[] = [];
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, status: "passed" });
    console.log("PASS", name);
  } catch {
    results.push({ name, status: "failed" });
    console.error("FAIL", name);
  }
}
try {
  await test("Registry stores a hash rather than the bearer identifier", async () => {
    const id = await createSession(f.db, f.seed[0].email);
    const row = await f.db
      .prepare("SELECT token_hash FROM auth_sessions WHERE email=?")
      .bind(f.seed[0].email)
      .first<{ token_hash: string }>();
    assert.match(id, /^[a-f0-9]{64}$/);
    assert.notEqual(row?.token_hash, id);
    assert.equal(
      (await sessionIdentity(f.db, id, f.seed[0].email))?.email,
      f.seed[0].email,
    );
    assert.equal(await sessionIdentity(f.db, id, f.seed[1].email), null);
    await revokeSession(f.db, id);
    assert.equal(await sessionIdentity(f.db, id, f.seed[0].email), null);
  });
  await test("Absolute expiry cannot be extended by refreshing the JWT", async () => {
    const id = await createSession(f.db, f.seed[0].email);
    await f.db
      .prepare(
        "UPDATE auth_sessions SET created_at=CURRENT_TIMESTAMP-INTERVAL '3 hours',expires_at=CURRENT_TIMESTAMP-INTERVAL '1 minute' WHERE email=?",
      )
      .bind(f.seed[0].email)
      .run();
    assert.equal(await sessionIdentity(f.db, id, f.seed[0].email), null);
  });
  await test("Old, malformed, and mismatched session claims fail closed", async () => {
    for (const id of [
      undefined,
      "invalid",
      "0".repeat(64),
      { email: f.seed[0].email },
    ])
      assert.equal(await sessionIdentity(f.db, id, f.seed[0].email), null);
  });
  await test("Client session updates cannot change email or grant admin claims", async () => {
    const options = authOptions(() => f.db);
    const token = await options.callbacks!.jwt!({
      token: {},
      user: { email: f.seed[0].email, name: "Student" },
    } as never);
    const updated = await options.callbacks!.jwt!({
      token,
      trigger: "update",
      session: {
        email: "admin@example.com",
        role: "admin",
        user: { email: "admin@example.com" },
      },
    } as never);
    assert.equal(updated.email, f.seed[0].email);
    const session = await options.callbacks!.session!({
      token: updated,
      session: { expires: "", user: { email: "admin@example.com" } },
    } as never);
    assert.equal(session.user?.email, f.seed[0].email);
    assert.equal("sessionId" in session, false);
    assert.equal("role" in session, false);
  });
  await test("Suspension revokes every existing session and restoration does not revive them", async () => {
    const email = f.seed[1].email;
    const ids = [
      await createSession(f.db, email),
      await createSession(f.db, email),
    ];
    assert.equal(
      (
        await f.request("block", {
          body: { crn: f.seed[1].crn, blocked: true },
        })
      ).status,
      200,
    );
    for (const id of ids)
      assert.equal(await sessionIdentity(f.db, id, email), null);
    await assert.rejects(() => createSession(f.db, email));
    await f.request("block", { body: { crn: f.seed[1].crn, blocked: false } });
    for (const id of ids)
      assert.equal(await sessionIdentity(f.db, id, email), null);
    const fresh = await createSession(f.db, email);
    assert.equal((await sessionIdentity(f.db, fresh, email))?.email, email);
  });
  await test("Database outage cannot authorize a valid-shaped session", async () => {
    const unavailable = {
      prepare() {
        throw new Error("Database unavailable");
      },
    } as never;
    await assert.rejects(() =>
      sessionIdentity(unavailable, "a".repeat(64), f.seed[0].email),
    );
    await assert.rejects(() => revokeSession(unavailable, "a".repeat(64)));
  });
  await test("Demo authentication attempts are limited across requests", async () => {
    await f.db
      .prepare("DELETE FROM rate_limits WHERE identity='local-demo'")
      .run();
    for (let i = 0; i < 20; i++)
      assert.equal(await demoAttemptAllowed(f.db), true);
    assert.equal(await demoAttemptAllowed(f.db), false);
    await f.db
      .prepare(
        "UPDATE rate_limits SET window_id=window_id-1 WHERE identity='local-demo'",
      )
      .run();
    assert.equal(await demoAttemptAllowed(f.db), true);
  });
  await test("Student cannot invoke suspension or roster endpoints with forged identity fields", async () => {
    assert.equal(
      (
        await f.request("roster", {
          email: f.seed[0].email,
          params: { email: "admin@example.com" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request("block", {
          email: f.seed[0].email,
          body: { crn: f.seed[1].crn, blocked: true },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request("join", {
          email: f.seed[0].email,
          body: { event_id: "fake", email: f.seed[1].email },
        })
      ).status,
      400,
    );
  });
} finally {
  await f.pg.close();
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/security-report.json",
    JSON.stringify(
      {
        passed: results.filter((r) => r.status === "passed").length,
        failed: results.filter((r) => r.status === "failed").length,
        results,
      },
      null,
      2,
    ),
  );
}
if (results.some((r) => r.status === "failed")) process.exitCode = 1;
