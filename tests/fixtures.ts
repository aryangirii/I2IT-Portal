import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import { SqlDatabase } from "../lib/db/database";
import { portalRequest } from "../lib/http/portal";
import { HttpError } from "../lib/server";
import { toCSV } from "../lib/csv";
export async function fixture(size = 500) {
  const pg = new PGlite();
  for (const migration of (await readdir("db/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile("db/migrations/" + migration, "utf8"));
  const executor = {
    async query(sql: string, values?: unknown[]) {
      const result = await pg.query<Record<string, unknown>>(sql, values);
      return { rows: result.rows, rowCount: result.affectedRows };
    },
  };
  const db = new SqlDatabase(executor, (fn) =>
    pg.transaction(async (tx) =>
      fn({
        async query(sql, values) {
          const r = await tx.query<Record<string, unknown>>(sql, values);
          return { rows: r.rows, rowCount: r.affectedRows };
        },
      }),
    ),
  );
  const seed = Array.from({ length: size }, (_, i) => ({
    crn: "C" + (23222 + i),
    name: "Student " + (i + 1),
    email: "student" + (i + 1) + "@example.com",
    department: "Computer Engineering",
    batch: "2027",
  }));
  const csv = toCSV(seed, ["crn", "name", "email", "department", "batch"]);
  async function request(
    action: string,
    options: {
      email?: string;
      authenticated?: boolean;
      body?: Record<string, unknown>;
      params?: Record<string, string>;
      origin?: string;
      marker?: boolean;
      contentType?: string;
    } = {},
  ) {
    const {
      email = "admin@example.com",
      authenticated = true,
      body,
      params = {},
      origin = "https://portal.test",
      marker = true,
      contentType = "application/json",
    } = options;
    const req = new Request(
      "https://portal.test/api/portal?" +
        new URLSearchParams({ action, ...params }),
      {
        method: body ? "POST" : "GET",
        headers: body
          ? {
              "Content-Type": contentType,
              Origin: origin,
              ...(marker ? { "X-Portal-Request": "1" } : {}),
            }
          : {},
        body: body ? JSON.stringify({ action, ...body }) : undefined,
      },
    );
    return portalRequest(req, Boolean(body), {
      getDatabase: () => db,
      getActor: async () => {
        if (!authenticated) throw new HttpError(401, "Sign in to continue.");
        return {
          email,
          userId: email,
          displayName: "Test User",
          admin: email === "admin@example.com",
        };
      },
    });
  }
  async function json(
    action: string,
    options: Parameters<typeof request>[1] = {},
  ) {
    const r = await request(action, options);
    return { status: r.status, data: await r.json() };
  }
  const event = {
    title: "Pre-placement talk",
    company: "Test Company",
    starts_at: new Date(Date.now() - 600000).toISOString(),
    ends_at: new Date(Date.now() + 3600000).toISOString(),
    meeting_url: "https://meet.google.com/abc-defg-hij",
    crns: seed.map((s) => s.crn),
  };
  return { pg, db, seed, csv, event, request, json };
}
