import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "pglite-server";
const pg = new PGlite();
await pg.exec(await readFile("db/migrations/001_initial.sql", "utf8"));
const wire = createServer(pg, { logLevel: 0 });
wire.listen(0, "127.0.0.1");
await once(wire, "listening");
const port = wire.address().port;
const origin = "http://localhost:3107";
const env = {
  ...process.env,
  NEXTAUTH_URL: origin,
  NEXTAUTH_SECRET: randomBytes(32).toString("hex"),
  DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/postgres`,
  DB_POOL_MAX: "1",
  LOCAL_DEMO_ENABLED: "true",
  LOCAL_DEMO_PASSWORD: "local-http-test-only-2026",
  TNP_ADMIN_EMAILS: "admin@example.com",
  GOOGLE_CLIENT_ID: "local-oauth-initiation-test.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "local-oauth-test-not-real",
  NODE_ENV: "development",
};
delete env.VERCEL;
const app = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3107",
  ],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
for (const stream of [app.stdout, app.stderr])
  stream.on("data", (b) => {
    logs += b.toString();
  });
const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, status: "passed" });
  console.log("PASS", name);
}
function jar() {
  const cookies = new Map();
  return {
    headers() {
      return [...cookies].map(([k, v]) => k + "=" + v).join("; ");
    },
    save(response) {
      for (const header of response.headers.getSetCookie()) {
        const pair = header.split(";")[0];
        const i = pair.indexOf("=");
        cookies.set(pair.slice(0, i), pair.slice(i + 1));
      }
    },
  };
}
async function request(
  path,
  { cookies, body, method = body ? "POST" : "GET", headers = {} } = {},
) {
  const response = await fetch(origin + path, {
    method,
    headers: { ...(cookies ? { Cookie: cookies.headers() } : {}), ...headers },
    body,
    redirect: "manual",
  });
  cookies?.save(response);
  return response;
}
async function login(role, password = env.LOCAL_DEMO_PASSWORD) {
  const cookies = jar();
  const csrf = await request("/api/auth/csrf", { cookies });
  const { csrfToken } = await csrf.json();
  const response = await request("/api/auth/callback/local-demo", {
    cookies,
    body: new URLSearchParams({
      csrfToken,
      role,
      password,
      json: "true",
      callbackUrl: origin,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  assert.equal(
    response.status,
    password === env.LOCAL_DEMO_PASSWORD ? 200 : 401,
  );
  return cookies;
}
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch(origin + "/api/auth/providers");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error("App failed to start: " + logs.slice(-2000));
  await check(
    "Login page and college logo served with security headers",
    async () => {
      const r = await request("/");
      assert.equal(r.status, 200);
      assert.match(await r.text(), /Placement Desk/);
      assert.equal(r.headers.get("X-Frame-Options"), "DENY");
      assert.equal((await request("/college-logo.png")).status, 200);
    },
  );
  await check(
    "Anonymous API and spoofed hosting identity rejected",
    async () => {
      assert.equal(
        (
          await request("/api/portal?action=dashboard", {
            headers: {
              "oai-authenticated-user-email": "admin@example.com",
              "oai-authenticated-user-id": "admin",
            },
          })
        ).status,
        401,
      );
    },
  );
  await check("Incorrect demo password cannot create a session", async () => {
    const bad = await login("admin", "incorrect-password");
    assert.equal(
      (await request("/api/portal?action=dashboard", { cookies: bad })).status,
      401,
    );
  });
  await check(
    "Configured Google provider is available without exposing its secret",
    async () => {
      const response = await request("/api/auth/providers");
      assert.equal(response.status, 200);
      const text = await response.text();
      const providers = JSON.parse(text);
      assert.equal(providers.google.type, "oauth");
      assert.equal(
        providers.google.callbackUrl,
        origin + "/api/auth/callback/google",
      );
      assert.ok(!text.includes(env.GOOGLE_CLIENT_SECRET));
    },
  );
  const admin = await login("admin");
  const student = await login("student");
  const outsider = await login("outsider");
  const post = async (action, body, cookies = admin) => {
    const r = await request("/api/portal", {
      cookies,
      body: JSON.stringify({ action, ...body }),
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        "X-Portal-Request": "1",
      },
    });
    return { status: r.status, data: await r.json() };
  };
  const get = async (action, cookies = admin) => {
    const r = await request("/api/portal?action=" + action, { cookies });
    return { status: r.status, data: await r.json() };
  };
  await check(
    "Real session cookies distinguish student and administrator",
    async () => {
      assert.equal((await get("dashboard", admin)).data.user.admin, true);
      assert.equal((await get("dashboard", student)).data.user.admin, false);
      assert.equal((await get("roster", student)).status, 403);
    },
  );
  await check("HTTP roster preview and confirmed import", async () => {
    const csv = await readFile("public/samples/students-500.csv", "utf8");
    assert.equal((await post("import_roster", { csv })).data.count, 500);
    assert.equal(
      (await post("import_roster", { csv, confirm: true })).status,
      200,
    );
    assert.equal((await get("dashboard", student)).data.student.crn, "C23222");
  });
  const start = new Date(Date.now() - 5 * 60000).toISOString(),
    end = new Date(Date.now() + 3600000).toISOString();
  let id;
  await check("HTTP event creation and publishing", async () => {
    const event = await post("create_event", {
      title: "HTTP test talk",
      company: "Sample Company",
      starts_at: start,
      ends_at: end,
      meeting_url: "https://meet.google.com/abc-defg-hij",
      crns: ["C23222"],
    });
    assert.equal(event.status, 200);
    id = event.data.id;
    assert.equal(
      (await post("publish", { event_id: id, confirm_controls: true })).status,
      200,
    );
  });
  await check(
    "Eligible student admitted, copied identifier cannot admit outsider",
    async () => {
      assert.equal((await post("join", { event_id: id }, student)).status, 200);
      assert.equal(
        (await post("join", { event_id: id }, outsider)).status,
        403,
      );
    },
  );
  await check(
    "HTTP attendance import and private student history",
    async () => {
      const csv = `email,joined_at,left_at\nstudent1@example.com,${start},${end}`;
      assert.equal(
        (await post("import_attendance", { event_id: id, csv, confirm: true }))
          .status,
        200,
      );
      assert.equal((await get("attendance", student)).data.length, 1);
      assert.equal((await get("attendance", outsider)).data.length, 0);
    },
  );
  await check(
    "Suspension and restoration apply to an existing student session",
    async () => {
      assert.equal(
        (await post("block", { crn: "C23222", blocked: true })).status,
        200,
      );
      assert.equal((await post("join", { event_id: id }, student)).status, 403);
      assert.equal((await get("dashboard", student)).data.student.blocked, 1);
      assert.equal(
        (await post("block", { crn: "C23222", blocked: false })).status,
        200,
      );
      assert.equal((await post("join", { event_id: id }, student)).status, 200);
    },
  );
  await check("Administrator exports and access/audit records", async () => {
    for (const type of ["invites", "attendance"]) {
      const r = await request(
        `/api/portal?action=export&type=${type}&id=${id}`,
        { cookies: admin },
      );
      assert.equal(r.status, 200);
      assert.match(await r.text(), /student1@example.com/);
      assert.equal(
        (
          await request(`/api/portal?action=export&type=${type}&id=${id}`, {
            cookies: student,
          })
        ).status,
        403,
      );
    }
    const detail = await get("event&id=" + id);
    assert.ok(detail.data.access.some((row) => row.decision === "denied"));
    assert.ok((await get("audit")).data.length > 0);
  });
  await check(
    "Editing eligibility returns event to draft and removes student admission",
    async () => {
      const updated = await post("update_event", {
        event_id: id,
        title: "Edited HTTP talk",
        company: "Sample Company",
        starts_at: start,
        ends_at: end,
        meeting_url: "https://meet.google.com/abc-defg-hij",
        crns: ["C23223"],
      });
      assert.equal(updated.status, 200);
      assert.equal((await get("dashboard", student)).data.events.length, 0);
      assert.equal((await post("join", { event_id: id }, student)).status, 403);
      assert.equal(
        (await post("publish", { event_id: id, confirm_controls: true }))
          .status,
        200,
      );
      assert.equal((await post("join", { event_id: id }, student)).status, 403);
    },
  );
  await check(
    "Cross-origin writes rejected with a real administrator cookie",
    async () => {
      const r = await request("/api/portal", {
        cookies: admin,
        body: JSON.stringify({ action: "close", event_id: id }),
        headers: {
          "Content-Type": "application/json",
          Origin: "https://untrusted.example",
          "X-Portal-Request": "1",
        },
      });
      assert.equal(r.status, 403);
    },
  );
  await check("Close and closed-event edit protection over HTTP", async () => {
    assert.equal((await post("close", { event_id: id })).status, 200);
    assert.equal(
      (await post("publish", { event_id: id, confirm_controls: true })).status,
      409,
    );
  });
  await check("Tampered session cookie rejected", async () => {
    const r = await request("/api/portal?action=dashboard", {
      headers: { Cookie: "next-auth.session-token=invalid-token" },
    });
    assert.equal(r.status, 401);
  });
  await check("Database health check succeeds over node-postgres", async () => {
    assert.equal((await request("/api/health")).status, 200);
  });
  await check("Sign out invalidates browser session", async () => {
    const r = await request("/api/auth/csrf", { cookies: student });
    const { csrfToken } = await r.json();
    await request("/api/auth/signout", {
      cookies: student,
      body: new URLSearchParams({
        csrfToken,
        json: "true",
        callbackUrl: origin,
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    assert.equal((await get("dashboard", student)).status, 401);
  });
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/http-report.json",
    JSON.stringify(
      {
        passed: results.length,
        mode: "Next.js development HTTP server, real NextAuth sessions and node-postgres connection to local embedded PostgreSQL",
        results,
      },
      null,
      2,
    ),
  );
  console.log("HTTP checks passed:", results.length);
} catch (error) {
  console.error(logs.slice(-3000));
  throw error;
} finally {
  app.kill("SIGTERM");
  await Promise.race([
    once(app, "exit"),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  app.kill("SIGKILL");
  wire.close();
  await pg.close();
}
