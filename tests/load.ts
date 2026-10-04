import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { writeFile, mkdir } from "node:fs/promises";
import { fixture } from "./fixtures";
const f = await fixture(500);
try {
  assert.equal(
    (await f.request("import_roster", { body: { csv: f.csv, confirm: true } }))
      .status,
    200,
  );
  const event = await f.json("create_event", { body: f.event });
  const id = event.data.id;
  assert.equal(
    (
      await f.request("publish", {
        body: { event_id: id, confirm_controls: true },
      })
    ).status,
    200,
  );
  const timings: number[] = [];
  const start = performance.now();
  // All 500 requests start before any finishes, each with a distinct approved identity.
  const responses = await Promise.all(
    f.seed.map(async (s) => {
      const began = performance.now();
      const r = await f.request("join", {
        email: s.email,
        body: { event_id: id },
      });
      timings.push(performance.now() - began);
      return r.status;
    }),
  );
  timings.sort((a, b) => a - b);
  const failed = responses.filter((s) => s !== 200).length;
  const result = {
    test: "500 simultaneous admission requests",
    database:
      "single embedded PostgreSQL instance, not a hosted production capacity test",
    concurrency: 500,
    requests: 500,
    failed,
    totalMs: Math.round(performance.now() - start),
    p50Ms: Math.round(timings[249]),
    p95Ms: Math.round(timings[474]),
    p99Ms: Math.round(timings[494]),
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/load-report.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(result);
  assert.equal(failed, 0);
} finally {
  await f.pg.close();
}
