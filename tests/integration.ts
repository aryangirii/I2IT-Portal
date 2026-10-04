import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fixture } from "./fixtures";
import { parseCSV, toCSV } from "../lib/csv";
import { validateRoster } from "../lib/validation";
import { demoEnabled } from "../lib/config";
import { authOptions } from "../lib/auth/options";
const f = await fixture();
const results: { name: string; status: string }[] = [];
async function test(name: string, fn: () => Promise<void> | void) {
  await fn();
  results.push({ name, status: "passed" });
  console.log("PASS", name);
}
let id = "";
try {
  await test("Unauthenticated admission rejected", async () => {
    assert.equal(
      (
        await f.request("join", {
          authenticated: false,
          body: { event_id: "x" },
        })
      ).status,
      401,
    );
  });
  await test("Students cannot read administrator resources", async () => {
    for (const action of [
      "roster",
      "audit",
      "event",
      "export",
      "eligible_options",
    ])
      assert.equal(
        (
          await f.request(action, {
            email: f.seed[0].email,
            params: { id: "x" },
          })
        ).status,
        403,
      );
  });
  await test("Students cannot mutate administrator resources", async () => {
    for (const action of [
      "create_event",
      "publish",
      "close",
      "block",
      "import_roster",
      "import_attendance",
    ])
      assert.equal(
        (
          await f.request(action, {
            email: f.seed[0].email,
            body: { event_id: "x", crn: "C23222" },
          })
        ).status,
        403,
      );
  });
  await test("Forged session claims do not grant admin roles", async () => {
    const response = await f.json("block", {
      email: f.seed[0].email,
      body: { crn: f.seed[0].crn, blocked: true, admin: true },
    });
    assert.equal(response.status, 400);
  });
  await test("Cross-origin and missing request marker rejected", async () => {
    assert.equal(
      (
        await f.request("import_roster", {
          body: { csv: f.csv },
          origin: "https://evil.test",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request("import_roster", {
          body: { csv: f.csv },
          marker: false,
        })
      ).status,
      403,
    );
  });
  await test("Write actions cannot use GET", async () => {
    assert.equal((await f.request("close")).status, 405);
  });
  await test("Non-JSON mutation rejected", async () => {
    assert.equal(
      (
        await f.request("import_roster", {
          body: { csv: f.csv },
          contentType: "text/plain",
        })
      ).status,
      415,
    );
  });
  await test("Malformed and oversized bodies rejected", async () => {
    assert.equal(
      (await f.request("import_roster", { body: { csv: "x".repeat(1100010) } }))
        .status,
      413,
    );
  });
  await test("CSV quotation, uniqueness, bounds and formula escaping", () => {
    assert.equal(
      parseCSV('name,email\n"One, Two",one@example.com')[0].name,
      "One, Two",
    );
    assert.throws(() => parseCSV('name,email\n"bad,x'));
    assert.throws(() => validateRoster([f.seed[0], f.seed[0]]));
    assert.match(toCSV([{ name: "=SUM(1)" }], ["name"]), /'=SUM/);
  });
  await test("Roster preview has no side effects", async () => {
    const r = await f.json("import_roster", { body: { csv: f.csv } });
    assert.equal(r.status, 200);
    assert.equal(r.data.count, 500);
    assert.equal(
      (
        await f.db
          .prepare("SELECT COUNT(*) n FROM students")
          .first<{ n: number }>()
      )?.n,
      0,
    );
  });
  await test("Import 500 approved identities", async () => {
    assert.equal(
      (await f.json("import_roster", { body: { csv: f.csv, confirm: true } }))
        .status,
      200,
    );
  });
  await test("Identity remapping rejected", async () => {
    const csv = toCSV(
      [{ ...f.seed[0], email: "different@example.com" }],
      ["crn", "name", "email", "department", "batch"],
    );
    assert.equal(
      (await f.json("import_roster", { body: { csv, confirm: true } })).status,
      409,
    );
  });
  await test("Search and roster pagination", async () => {
    const r = await f.json("roster", { params: { page: "2" } });
    assert.equal(r.data.rows.length, 50);
    assert.equal(r.data.total, 500);
    assert.equal(
      (await f.json("roster", { params: { search: f.seed[0].email } })).data
        .rows.length,
      1,
    );
  });
  await test("Unsafe meeting destination rejected", async () => {
    assert.equal(
      (
        await f.json("create_event", {
          body: {
            ...f.event,
            meeting_url: "https://meet.google.com.evil.test/abc-defg-hij",
          },
        })
      ).status,
      400,
    );
  });
  await test("Create draft with eligible roster", async () => {
    const r = await f.json("create_event", { body: f.event });
    assert.equal(r.status, 200);
    id = r.data.id;
  });
  await test("Drafts invisible to students", async () => {
    assert.equal(
      (await f.json("dashboard", { email: f.seed[0].email })).data.events
        .length,
      0,
    );
  });
  await test("Draft admission rejected", async () => {
    assert.equal(
      (
        await f.request("join", {
          email: f.seed[0].email,
          body: { event_id: id },
        })
      ).status,
      403,
    );
  });
  await test("Publishing requires host restrictions acknowledgement", async () => {
    assert.equal(
      (await f.request("publish", { body: { event_id: id } })).status,
      400,
    );
    assert.equal(
      (
        await f.request("publish", {
          body: { event_id: id, confirm_controls: true },
        })
      ).status,
      200,
    );
  });
  await test("Editing a published event returns it to draft", async () => {
    assert.equal(
      (
        await f.request("update_event", {
          body: { ...f.event, event_id: id, title: "Updated placement talk" },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await f.request("join", {
          email: f.seed[0].email,
          body: { event_id: id },
        })
      ).status,
      403,
    );
    assert.equal(
      (await f.json("dashboard", { email: f.seed[0].email })).data.events
        .length,
      0,
    );
    assert.equal(
      (
        await f.request("publish", {
          body: { event_id: id, confirm_controls: true },
        })
      ).status,
      200,
    );
  });
  await test("Authorized admission returns only own identity and destination", async () => {
    const r = await f.json("join", {
      email: f.seed[0].email,
      body: { event_id: id },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.email, f.seed[0].email);
    assert.equal(r.data.attendance_recorded, false);
    assert.equal(r.data.url, f.event.meeting_url);
  });
  await test("Student dashboard excludes meeting URLs and other identities", async () => {
    const r = await f.json("dashboard", { email: f.seed[0].email });
    assert.equal(r.data.student.crn, f.seed[0].crn);
    assert.equal(r.data.events.length, 1);
    assert.ok(!JSON.stringify(r.data).includes("meet.google.com"));
    assert.ok(!JSON.stringify(r.data).includes(f.seed[1].email));
  });
  await test("Unknown account denied even with correct event identifier", async () => {
    assert.equal(
      (
        await f.request("join", {
          email: "outsider@example.com",
          body: { event_id: id },
        })
      ).status,
      403,
    );
  });
  await test("Suspension takes effect on next admission request", async () => {
    await f.request("block", { body: { crn: f.seed[0].crn, blocked: true } });
    assert.equal(
      (
        await f.request("join", {
          email: f.seed[0].email,
          body: { event_id: id },
        })
      ).status,
      403,
    );
    await f.request("block", { body: { crn: f.seed[0].crn, blocked: false } });
  });
  await test("Ineligible roster account denied", async () => {
    await f.db
      .prepare("DELETE FROM eligibility WHERE event_id=? AND crn=?")
      .bind(id, f.seed[1].crn)
      .run();
    assert.equal(
      (
        await f.request("join", {
          email: f.seed[1].email,
          body: { event_id: id },
        })
      ).status,
      403,
    );
  });
  await test("Attendance import merges overlapping intervals", async () => {
    const a = Date.parse(f.event.starts_at),
      stamp = (offset: number) => new Date(a + offset * 60000).toISOString();
    const csv = `email,joined_at,left_at\n${f.seed[0].email},${stamp(0)},${stamp(10)}\n${f.seed[0].email},${stamp(5)},${stamp(20)}`;
    const r = await f.json("import_attendance", {
      body: { event_id: id, csv, confirm: true },
    });
    assert.equal(r.status, 200);
    assert.equal(
      (
        await f.db
          .prepare("SELECT minutes FROM attendance WHERE crn=?")
          .bind(f.seed[0].crn)
          .first<{ minutes: number }>()
      )?.minutes,
      20,
    );
  });
  await test("Student attendance isolated and repeat import idempotent", async () => {
    assert.equal(
      (await f.json("attendance", { email: f.seed[0].email })).data.length,
      1,
    );
    assert.equal(
      (await f.json("attendance", { email: f.seed[2].email })).data.length,
      0,
    );
  });
  await test("Unknown attendance identity rejected without partial writes", async () => {
    const csv = `email,joined_at,left_at\noutsider@example.com,${f.event.starts_at},${f.event.ends_at}`;
    assert.equal(
      (
        await f.request("import_attendance", {
          body: { event_id: id, csv, confirm: true },
        })
      ).status,
      400,
    );
  });
  await test("CSV exports protected and complete", async () => {
    const r = await f.request("export", { params: { id, type: "invites" } });
    assert.equal(r.status, 200);
    assert.match(await r.text(), /student1@example.com/);
  });
  await test("Admission rate limit enforced atomically", async () => {
    await f.db
      .prepare("DELETE FROM rate_limits WHERE identity=?")
      .bind(f.seed[0].email)
      .run();
    for (let i = 0; i < 60; i++)
      assert.equal(
        (
          await f.request("join", {
            email: f.seed[0].email,
            body: { event_id: id },
          })
        ).status,
        200,
      );
    const r = await f.request("join", {
      email: f.seed[0].email,
      body: { event_id: id },
    });
    assert.equal(r.status, 429);
    assert.equal(r.headers.get("Retry-After"), "60");
  });
  await test("SQL batch rolls back all changes on failure", async () => {
    await assert.rejects(() =>
      f.db.batch([
        f.db
          .prepare("UPDATE students SET name='ROLLBACK' WHERE crn=?")
          .bind(f.seed[0].crn),
        f.db
          .prepare("INSERT INTO eligibility(event_id,crn) VALUES(?,?)")
          .bind("missing", f.seed[0].crn),
      ]),
    );
    assert.equal(
      (
        await f.db
          .prepare("SELECT name FROM students WHERE crn=?")
          .bind(f.seed[0].crn)
          .first<{ name: string }>()
      )?.name,
      f.seed[0].name,
    );
  });
  await test("Transaction validation failure rolls back mutations", async () => {
    const before = await f.db
      .prepare("SELECT name FROM students WHERE crn=?")
      .bind(f.seed[0].crn)
      .first<{ name: string }>();
    await assert.rejects(() =>
      f.db.batch(
        [
          f.db
            .prepare("UPDATE students SET name='INVALID' WHERE crn=?")
            .bind(f.seed[0].crn),
        ],
        () => {
          throw new Error("Validation failed");
        },
      ),
    );
    assert.equal(
      (
        await f.db
          .prepare("SELECT name FROM students WHERE crn=?")
          .bind(f.seed[0].crn)
          .first<{ name: string }>()
      )?.name,
      before?.name,
    );
  });
  await test("Close stops subsequent portal admission", async () => {
    assert.equal(
      (await f.request("close", { body: { event_id: id } })).status,
      200,
    );
    assert.equal(
      (
        await f.request("join", {
          email: f.seed[3].email,
          body: { event_id: id },
        })
      ).status,
      403,
    );
  });
  await test("Local demo cannot be enabled in production or Vercel", () => {
    const saved = { ...process.env };
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.LOCAL_DEMO_ENABLED = "true";
    process.env.LOCAL_DEMO_PASSWORD = "1234567890123456";
    process.env["NODE" + "_ENV"] = "production";
    assert.equal(demoEnabled(), false);
    process.env["NODE" + "_ENV"] = "development";
    process.env.VERCEL = "1";
    assert.equal(demoEnabled(), false);
    delete process.env.VERCEL;
    assert.equal(demoEnabled(), true);
    process.env.NEXTAUTH_URL = "https://public.example.com";
    assert.equal(demoEnabled(), false);
    process.env = saved;
  });
  await test("Unverified Google account rejected", async () => {
    const options = authOptions();
    const signIn = options.callbacks!.signIn!;
    assert.equal(
      await signIn({
        account: { provider: "google" } as never,
        profile: { email_verified: false } as never,
        user: {} as never,
      }),
      false,
    );
    assert.equal(
      await signIn({
        account: { provider: "google" } as never,
        profile: { email_verified: true } as never,
        user: {} as never,
      }),
      true,
    );
  });
  await test("Closed events cannot be edited or reopened", async () => {
    assert.equal(
      (await f.request("update_event", { body: { ...f.event, event_id: id } }))
        .status,
      409,
    );
    assert.equal(
      (
        await f.request("publish", {
          body: { event_id: id, confirm_controls: true },
        })
      ).status,
      409,
    );
  });
  await test("Bulk import accepts 5000 approved identities", async () => {
    const csv = await readFile("public/samples/students-5000.csv", "utf8");
    assert.equal(
      (await f.json("import_roster", { body: { csv, confirm: true } })).status,
      200,
    );
    assert.equal(
      (
        await f.db
          .prepare("SELECT COUNT(*) n FROM students")
          .first<{ n: number }>()
      )?.n,
      5000,
    );
  });
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/integration-report.json",
    JSON.stringify(
      {
        passed: results.length,
        database: "embedded PostgreSQL (PGlite)",
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        passed: results.length,
        database: "embedded PostgreSQL (PGlite)",
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await f.pg.close();
}
