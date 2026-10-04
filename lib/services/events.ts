import { googleAdmission } from "@/lib/meetings/google";
import { HttpError, now, auditStatement } from "@/lib/server";
import { eventSchema } from "@/lib/validation";
import { reply, type RequestContext } from "@/lib/services/context";
export async function eventsHandler(ctx: RequestContext) {
  const { user, db, url, body, action, joinRecord } = ctx;
  if (action === "create_event") {
    const p = eventSchema.safeParse(body);
    if (!p.success) throw new HttpError(400, p.error.issues[0].message);
    const v = p.data,
      crns = [...new Set(v.crns)];
    const roster = (
      await db.prepare("SELECT crn FROM students WHERE blocked=0").all<{
        crn: string;
      }>()
    ).results;
    const known = new Set(roster.map((r) => r.crn));
    if (crns.some((crn) => !known.has(crn)))
      throw new HttpError(
        400,
        "Select eligible, active students from the roster.",
      );
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          "INSERT INTO events(id,title,company,starts_at,ends_at,meeting_url,status,created_at) VALUES(?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          v.title,
          v.company,
          v.starts_at,
          v.ends_at,
          v.meeting_url,
          "draft",
          now(),
        ),
      db
        .prepare(
          "INSERT INTO eligibility(event_id,crn) SELECT ?,value FROM jsonb_array_elements_text(?::jsonb)",
        )
        .bind(id, JSON.stringify(crns)),
      auditStatement(db, user.email, "Event created", v.title),
    ]);
    return reply({ id });
  }
  if (action === "update_event") {
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success)
      throw new HttpError(400, parsed.error.issues[0].message);
    const current = await db
      .prepare("SELECT status FROM events WHERE id=?")
      .bind(body.event_id)
      .first<{ status: string }>();
    if (!current) throw new HttpError(404, "Event not found.");
    if (current.status === "closed")
      throw new HttpError(409, "Closed events cannot be edited.");
    const v = parsed.data,
      crns = [...new Set(v.crns)];
    const roster = await db
      .prepare("SELECT crn FROM students WHERE blocked=0")
      .all<{ crn: string }>();
    const active = new Set(roster.results.map((s) => s.crn));
    if (crns.some((crn) => !active.has(crn)))
      throw new HttpError(
        400,
        "Select eligible, active students from the roster.",
      );
    // Editing returns the event to draft so TNP must review provider invitations again.
    await db.batch(
      [
        db
          .prepare(
            "UPDATE events SET title=?,company=?,starts_at=?,ends_at=?,meeting_url=?,status='draft' WHERE id=? AND status <> 'closed' RETURNING id",
          )
          .bind(
            v.title,
            v.company,
            v.starts_at,
            v.ends_at,
            v.meeting_url,
            body.event_id,
          ),
        db
          .prepare("DELETE FROM eligibility WHERE event_id=?")
          .bind(body.event_id),
        db
          .prepare(
            "INSERT INTO eligibility(event_id,crn) SELECT ?,value FROM jsonb_array_elements_text(?::jsonb)",
          )
          .bind(body.event_id, JSON.stringify(crns)),
        auditStatement(
          db,
          user.email,
          "Event updated",
          `${body.event_id}: returned to draft for host review`,
        ),
      ],
      (result) => {
        if (!result[0].results.length)
          throw new HttpError(409, "Closed events cannot be edited.");
      },
    );
    return reply({ id: body.event_id });
  }
  if (action === "event") {
    const id = url.searchParams.get("id");
    const data = await db.batch([
      db.prepare("SELECT * FROM events WHERE id=?").bind(id),
      db
        .prepare(
          "SELECT s.* FROM students s JOIN eligibility g ON g.crn=s.crn WHERE g.event_id=? ORDER BY s.crn LIMIT 5000",
        )
        .bind(id),
      db
        .prepare(
          "SELECT a.*,s.name FROM attendance a JOIN students s ON s.crn=a.crn WHERE a.event_id=? ORDER BY s.crn LIMIT 5000",
        )
        .bind(id),
      db
        .prepare(
          "SELECT * FROM access_records WHERE event_id=? ORDER BY at DESC LIMIT 100",
        )
        .bind(id),
    ]);
    if (!data[0].results.length) throw new HttpError(404, "Event not found.");
    return reply({
      event: data[0].results[0],
      students: data[1].results,
      attendance: data[2].results,
      access: data[3].results,
    });
  }
  if (action === "publish") {
    if (!body.confirm_controls)
      throw new HttpError(
        400,
        "Confirm Google Meet access restrictions first.",
      );
    const e = await db
      .prepare("SELECT title,status FROM events WHERE id=?")
      .bind(body.event_id)
      .first<{
        title: string;
        status: string;
        meeting_url: string;
        starts_at: string;
        ends_at: string;
      }>();
    if (!e) throw new HttpError(404, "Event not found.");
    if (e.status !== "draft")
      throw new HttpError(409, "Only draft events can be published.");
    await db.batch(
      [
        db
          .prepare(
            "UPDATE events SET status='published' WHERE id=? AND status='draft' RETURNING id",
          )
          .bind(body.event_id),
        auditStatement(db, user.email, "Event published", e.title),
      ],
      (result) => {
        if (!result[0].results.length)
          throw new HttpError(409, "Only draft events can be published.");
      },
    );
    return reply({ ok: true });
  }
  if (action === "close") {
    const e = await db
      .prepare("SELECT id FROM events WHERE id=?")
      .bind(body.event_id)
      .first();
    if (!e) throw new HttpError(404, "Event not found.");
    await db.batch([
      db
        .prepare("UPDATE events SET status='closed' WHERE id=?")
        .bind(body.event_id),
      auditStatement(db, user.email, "Event closed", String(body.event_id)),
    ]);
    return reply({ ok: true });
  }
  if (action === "join") {
    const id = String(body.event_id ?? "");
    const e = joinRecord;
    if (!e) throw new HttpError(404, "Event not found.");
    const time = Date.now();
    const reason = !e.student_crn
      ? "Email is not on the official roster."
      : e.student_blocked
        ? "Your portal access is suspended."
        : !e.eligible
          ? "You are not eligible for this event."
          : e.status !== "published"
            ? "Joining is not open for this event."
            : time < Date.parse(e.starts_at) - 15 * 60000
              ? "Joining opens 15 minutes before the event."
              : time > Date.parse(e.ends_at)
                ? "This event has ended."
                : "Eligible account";
    const allowed = reason === "Eligible account";
    const bucket = Math.floor(time / 60000);
    await db
      .prepare(
        "INSERT INTO access_records(id,event_id,crn,email,decision,reason,at,bucket) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(event_id,email,bucket) DO UPDATE SET decision=excluded.decision,reason=excluded.reason,at=excluded.at",
      )
      .bind(
        crypto.randomUUID(),
        id,
        e.student_crn,
        user.email,
        allowed ? "allowed" : "denied",
        reason,
        now(),
        bucket,
      )
      .run();
    if (!allowed) throw new HttpError(403, reason);
    return reply(googleAdmission(e.meeting_url, user.email));
  }
  return undefined;
}
