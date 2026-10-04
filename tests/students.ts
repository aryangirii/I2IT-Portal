import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fixture } from "./fixtures";
import { toCSV } from "../lib/csv";
const f = await fixture(2);
const results: { name: string; status: string }[] = [];
const student = {
  crn: "C99001",
  name: "Manual Student",
  email: "manual@example.com",
  department: "Computer Engineering",
  batch: "2027",
};
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, status: "passed" });
    console.log("PASS", name);
  } catch (error) {
    results.push({ name, status: "failed" });
    console.error("FAIL", name);
    throw error;
  }
}
try {
  await test("Anonymous and student actors cannot create roster identities", async () => {
    assert.equal(
      (
        await f.request("create_student", {
          authenticated: false,
          body: { student },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await f.request("create_student", {
          email: f.seed[0].email,
          body: { student },
        })
      ).status,
      403,
    );
  });
  await test("Manual creation requires POST, same origin and request marker", async () => {
    assert.equal((await f.request("create_student")).status, 405);
    assert.equal(
      (
        await f.request("create_student", {
          origin: "https://other.example",
          body: { student },
        })
      ).status,
      403,
    );
    assert.equal(
      (await f.request("create_student", { marker: false, body: { student } }))
        .status,
      403,
    );
  });
  await test("Missing, malformed and privilege-bearing input cannot create a record", async () => {
    for (const body of [
      {},
      { student: { ...student, email: "invalid" } },
      { student: { ...student, crn: "a!" } },
      { student: { ...student, blocked: 0 } },
      { student, blocked: false },
    ])
      assert.equal((await f.request("create_student", { body })).status, 400);
    assert.equal(
      (
        await f.db
          .prepare("SELECT COUNT(*) n FROM students")
          .first<{ n: number }>()
      )?.n,
      0,
    );
  });
  await test("Administrator creates a normalized identity and audit record atomically", async () => {
    const response = await f.json("create_student", {
      body: {
        student: {
          ...student,
          crn: " c99001 ",
          email: " MANUAL@EXAMPLE.COM ",
          name: " Manual Student ",
        },
      },
    });
    assert.equal(response.status, 201);
    assert.deepEqual(response.data.student, student);
    const row = await f.db
      .prepare("SELECT * FROM students WHERE crn=?")
      .bind(student.crn)
      .first<{ email: string; blocked: number }>();
    assert.equal(row?.email, student.email);
    assert.equal(row?.blocked, 0);
    assert.equal(
      (
        await f.db
          .prepare("SELECT COUNT(*) n FROM audit WHERE action='Student added'")
          .first<{ n: number }>()
      )?.n,
      1,
    );
  });
  await test("Duplicate CRN/email and repeated submission cannot overwrite identities or add audit rows", async () => {
    for (const row of [
      student,
      { ...student, email: "another@example.com" },
      { ...student, crn: "C99002" },
    ])
      assert.equal(
        (await f.request("create_student", { body: { student: row } })).status,
        409,
      );
    assert.equal(
      (
        await f.db
          .prepare("SELECT COUNT(*) n FROM students")
          .first<{ n: number }>()
      )?.n,
      1,
    );
    assert.equal(
      (
        await f.db
          .prepare("SELECT COUNT(*) n FROM audit WHERE action='Student added'")
          .first<{ n: number }>()
      )?.n,
      1,
    );
  });
  await test("Manually added student remains ineligible until selected for an event", async () => {
    await f.request("import_roster", { body: { csv: f.csv, confirm: true } });
    const event = await f.json("create_event", { body: f.event });
    assert.equal(event.status, 200);
    await f.request("publish", {
      body: { event_id: event.data.id, confirm_controls: true },
    });
    assert.equal(
      (
        await f.request("join", {
          email: student.email,
          body: { event_id: event.data.id },
        })
      ).status,
      403,
    );
    await f.request("update_event", {
      body: { ...f.event, event_id: event.data.id, crns: [student.crn] },
    });
    await f.request("publish", {
      body: { event_id: event.data.id, confirm_controls: true },
    });
    assert.equal(
      (
        await f.request("join", {
          email: student.email,
          body: { event_id: event.data.id },
        })
      ).status,
      200,
    );
  });
  await test("CSV import shares the manual roster and preserves its identity mapping", async () => {
    const csv = toCSV(
      [{ ...student, name: "Updated Name" }],
      ["crn", "name", "email", "department", "batch"],
    );
    assert.equal(
      (await f.request("import_roster", { body: { csv, confirm: true } }))
        .status,
      200,
    );
    const bad = toCSV(
      [{ ...student, email: "replacement@example.com" }],
      ["crn", "name", "email", "department", "batch"],
    );
    assert.equal(
      (await f.request("import_roster", { body: { csv: bad, confirm: true } }))
        .status,
      409,
    );
    assert.equal(
      (
        await f.db
          .prepare("SELECT email FROM students WHERE crn=?")
          .bind(student.crn)
          .first<{ email: string }>()
      )?.email,
      student.email,
    );
  });
  await test("Suspended identities cannot be recreated or restored through manual entry", async () => {
    await f.request("block", { body: { crn: student.crn, blocked: true } });
    assert.equal(
      (await f.request("create_student", { body: { student } })).status,
      409,
    );
    assert.equal(
      (
        await f.db
          .prepare("SELECT blocked FROM students WHERE crn=?")
          .bind(student.crn)
          .first<{ blocked: number }>()
      )?.blocked,
      1,
    );
  });
  await test("Concurrent duplicate submissions create exactly one identity and audit entry", async () => {
    const entry = {
      ...student,
      crn: "C99003",
      email: "concurrent@example.com",
    };
    const responses = await Promise.all([
      f.request("create_student", { body: { student: entry } }),
      f.request("create_student", { body: { student: entry } }),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      (
        await f.db
          .prepare("SELECT COUNT(*) n FROM students WHERE crn=?")
          .bind(entry.crn)
          .first<{ n: number }>()
      )?.n,
      1,
    );
    assert.equal(
      (
        await f.db
          .prepare(
            "SELECT COUNT(*) n FROM audit WHERE action='Student added' AND detail=?",
          )
          .bind(entry.crn)
          .first<{ n: number }>()
      )?.n,
      1,
    );
  });
  await test("Manual creation rate limit returns 429", async () => {
    await f.db
      .prepare("DELETE FROM rate_limits WHERE action='create_student'")
      .run();
    for (let i = 0; i < 30; i++)
      assert.equal(
        (
          await f.request("create_student", {
            body: {
              student: {
                ...student,
                crn: "C" + (80000 + i),
                email: `limited${i}@example.com`,
              },
            },
          })
        ).status,
        201,
      );
    assert.equal(
      (
        await f.request("create_student", {
          body: {
            student: { ...student, crn: "C99999", email: "limit@example.com" },
          },
        })
      ).status,
      429,
    );
  });
} finally {
  await f.pg.close();
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/students-report.json",
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
