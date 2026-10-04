import { HttpError, now, auditStatement } from "@/lib/server";
import { parseCSV } from "@/lib/csv";
import { validateRoster } from "@/lib/validation";
import { reply, type RequestContext } from "@/lib/services/context";
export async function studentsHandler(ctx: RequestContext) {
  const { user, db, url, body, action } = ctx;
  if (action === "roster") {
    const page = Math.max(
      1,
      Math.min(10000, Math.floor(Number(url.searchParams.get("page")) || 1)),
    );
    const search = (url.searchParams.get("search") ?? "").slice(0, 100);
    const term = "%" + search + "%";
    const result = await db.batch([
      db
        .prepare(
          "SELECT * FROM students WHERE crn LIKE ? OR name LIKE ? OR email LIKE ? ORDER BY crn LIMIT 50 OFFSET ?",
        )
        .bind(term, term, term, (page - 1) * 50),
      db
        .prepare(
          "SELECT COUNT(*) n FROM students WHERE crn LIKE ? OR name LIKE ? OR email LIKE ?",
        )
        .bind(term, term, term),
    ]);
    return reply({
      rows: result[0].results,
      total: (
        result[1].results[0] as {
          n: number;
        }
      ).n,
      page,
    });
  }
  if (action === "import_roster") {
    const rows = validateRoster(parseCSV(String(body.csv ?? "")));
    const existing = (
      await db.prepare("SELECT crn,email FROM students").all<{
        crn: string;
        email: string;
      }>()
    ).results;
    const byCrn = new Map(existing.map((r) => [r.crn, r.email])),
      byEmail = new Map(existing.map((r) => [r.email, r.crn]));
    for (const r of rows) {
      if (byCrn.has(r.crn) && byCrn.get(r.crn) !== r.email)
        throw new HttpError(
          409,
          `${r.crn} already has a different email. Contact the administrator for an identity correction.`,
        );
      if (byEmail.has(r.email) && byEmail.get(r.email) !== r.crn)
        throw new HttpError(
          409,
          `${r.email} is already linked to another CRN.`,
        );
    }
    if (!body.confirm)
      return reply({ rows: rows.slice(0, 10), count: rows.length });
    await db.batch(
      [
        db
          .prepare(
            "INSERT INTO students(crn,name,email,department,batch,blocked,created_at) SELECT r.crn,r.name,r.email,r.department,r.batch,0,? FROM jsonb_to_recordset(?::jsonb) AS r(crn text,name text,email text,department text,batch text) ON CONFLICT(crn) DO UPDATE SET name=excluded.name,department=excluded.department,batch=excluded.batch WHERE students.email=excluded.email RETURNING crn",
          )
          .bind(now(), JSON.stringify(rows)),
        auditStatement(
          db,
          user.email,
          "Roster imported",
          `${rows.length} students processed`,
        ),
      ],
      (result) => {
        if (result[0].results.length !== rows.length)
          throw new HttpError(
            409,
            "Roster changed during import. Review identities and retry.",
          );
      },
    );
    return reply({ count: rows.length });
  }
  if (action === "block") {
    if (typeof body.blocked !== "boolean")
      throw new HttpError(400, "Invalid access status.");
    const s = await db
      .prepare("SELECT crn FROM students WHERE crn=?")
      .bind(body.crn)
      .first();
    if (!s) throw new HttpError(404, "Student not found.");
    await db.batch([
      db
        .prepare("UPDATE students SET blocked=? WHERE crn=?")
        .bind(body.blocked ? 1 : 0, body.crn),
      auditStatement(
        db,
        user.email,
        body.blocked ? "Student suspended" : "Student restored",
        String(body.crn),
      ),
    ]);
    return reply({ ok: true });
  }
  if (action === "eligible_options") {
    return reply(
      (
        await db
          .prepare(
            "SELECT crn,name,email,department,batch FROM students WHERE blocked=0 ORDER BY crn LIMIT 5000",
          )
          .all()
      ).results,
    );
  }
  return undefined;
}
