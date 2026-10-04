import { reply, type RequestContext } from "./context";
export async function studentAttendance(ctx: RequestContext) {
  const { db, student } = ctx;
  const r = student
    ? await db
        .prepare(
          "SELECT a.*,e.title,e.company FROM attendance a JOIN events e ON e.id=a.event_id WHERE a.crn=? ORDER BY e.starts_at DESC LIMIT 100",
        )
        .bind(student.crn)
        .all()
    : { results: [] };
  return reply(r.results);
}
