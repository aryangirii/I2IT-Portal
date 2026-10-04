import { HttpError, now, auditStatement } from "@/lib/server";
import { parseCSV, toCSV } from "@/lib/csv";
import { reply, type RequestContext } from "@/lib/services/context";
export async function attendanceHandler(ctx: RequestContext) {
  const { user, db, url, body, action } = ctx;
  if (action === "import_attendance") {
    const e = await db
      .prepare("SELECT starts_at,ends_at FROM events WHERE id=?")
      .bind(body.event_id)
      .first<{
        starts_at: string;
        ends_at: string;
      }>();
    if (!e) throw new HttpError(404, "Event not found.");
    const eligible = (
      await db
        .prepare(
          "SELECT s.crn,s.email FROM students s JOIN eligibility g ON g.crn=s.crn WHERE g.event_id=?",
        )
        .bind(body.event_id)
        .all<{
          email: string;
          crn: string;
        }>()
    ).results;
    const map = new Map(eligible.map((s) => [s.email, s.crn]));
    const rows = parseCSV(String(body.csv ?? "")),
      entries = new Map<
        string,
        {
          crn: string;
          joined: string;
          left: string;
          intervals: [number, number][];
        }
      >();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i],
        email = (r.email ?? "").toLowerCase(),
        crn = map.get(email);
      if (!crn)
        throw new HttpError(
          400,
          `Row ${i + 2}: email is not eligible for this event.`,
        );
      if (
        !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(
          r.joined_at ?? "",
        ) ||
        !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(r.left_at ?? "")
      )
        throw new HttpError(
          400,
          `Row ${i + 2}: use ISO timestamps with a timezone.`,
        );
      const a = Date.parse(r.joined_at),
        b = Date.parse(r.left_at);
      if (
        !Number.isFinite(a) ||
        !Number.isFinite(b) ||
        b < a ||
        a < Date.parse(e.starts_at) - 900000 ||
        b > Date.parse(e.ends_at) + 900000
      )
        throw new HttpError(
          400,
          `Row ${i + 2}: times fall outside this event.`,
        );
      const prev = entries.get(crn) ?? {
        crn,
        joined: new Date(a).toISOString(),
        left: new Date(b).toISOString(),
        intervals: [] as [number, number][],
      };
      prev.joined = new Date(
        Math.min(a, Date.parse(prev.joined)),
      ).toISOString();
      prev.left = new Date(Math.max(b, Date.parse(prev.left))).toISOString();
      prev.intervals.push([a, b]);
      entries.set(crn, prev);
    }
    const result = [...entries.values()].map((r) => {
      r.intervals.sort((a, b) => a[0] - b[0]);
      let total = 0,
        start = -1,
        end = -1;
      for (const [a, b] of r.intervals) {
        if (a > end) {
          if (start >= 0) total += end - start;
          start = a;
          end = b;
        } else end = Math.max(end, b);
      }
      if (start >= 0) total += end - start;
      return { ...r, minutes: Math.round(total / 60000) };
    });
    if (!body.confirm)
      return reply({ count: result.length, rows: result.slice(0, 10) });
    const records = result.map((r) => ({
      id: crypto.randomUUID(),
      event_id: body.event_id,
      crn: r.crn,
      joined_at: r.joined,
      left_at: r.left,
      minutes: r.minutes,
      source: "TNP report import",
      imported_at: now(),
    }));
    await db.batch([
      db
        .prepare(
          "INSERT INTO attendance(id,event_id,crn,joined_at,left_at,minutes,source,imported_at) SELECT r.id,r.event_id,r.crn,r.joined_at,r.left_at,r.minutes,r.source,r.imported_at FROM jsonb_to_recordset(?::jsonb) AS r(id text,event_id text,crn text,joined_at text,left_at text,minutes integer,source text,imported_at text) ON CONFLICT(event_id,crn) DO UPDATE SET joined_at=excluded.joined_at,left_at=excluded.left_at,minutes=excluded.minutes,source=excluded.source,imported_at=excluded.imported_at",
        )
        .bind(JSON.stringify(records)),
      auditStatement(
        db,
        user.email,
        "Attendance imported",
        `${result.length} records for ${body.event_id}`,
      ),
    ]);
    return reply({ count: result.length });
  }
  if (action === "attendance") {
    return reply(
      (
        await db
          .prepare(
            "SELECT a.*,s.name,s.email,e.title,e.company FROM attendance a JOIN students s ON s.crn=a.crn JOIN events e ON e.id=a.event_id ORDER BY a.imported_at DESC LIMIT 100",
          )
          .all()
      ).results,
    );
  }
  if (action === "audit")
    return reply(
      (await db.prepare("SELECT * FROM audit ORDER BY at DESC LIMIT 100").all())
        .results,
    );
  if (action === "export") {
    const id = url.searchParams.get("id");
    const type = url.searchParams.get("type");
    const r =
      type === "invites"
        ? await db
            .prepare(
              "SELECT s.crn,s.name,s.email FROM students s JOIN eligibility g ON s.crn=g.crn WHERE g.event_id=? AND s.blocked=0 ORDER BY s.crn LIMIT 5000",
            )
            .bind(id)
            .all()
        : await db
            .prepare(
              "SELECT s.crn,s.name,s.email,a.joined_at,a.left_at,a.minutes,a.source FROM attendance a JOIN students s ON s.crn=a.crn WHERE a.event_id=? ORDER BY s.crn LIMIT 5000",
            )
            .bind(id)
            .all();
    const keys =
      type === "invites"
        ? ["crn", "name", "email"]
        : ["crn", "name", "email", "joined_at", "left_at", "minutes", "source"];
    return new Response(toCSV(r.results, keys), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${type === "invites" ? "invites" : "attendance"}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return undefined;
}
