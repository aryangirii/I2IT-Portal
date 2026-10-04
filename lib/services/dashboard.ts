import { reply, type RequestContext } from "@/lib/services/context";
export async function dashboardHandler(ctx: RequestContext) {
  const { user, db, student, action } = ctx;
  if (action === "dashboard") {
    if (user.admin) {
      const data = await db.batch([
        db.prepare("SELECT COUNT(*) n, SUM(blocked) blocked FROM students"),
        db.prepare("SELECT COUNT(*) n FROM events"),
        db.prepare("SELECT COUNT(*) n FROM attendance"),
        db.prepare(
          "SELECT e.id,e.title,e.company,e.starts_at,e.ends_at,e.status, COUNT(g.crn) eligible_count FROM events e LEFT JOIN eligibility g ON g.event_id=e.id GROUP BY e.id ORDER BY e.starts_at DESC LIMIT 100",
        ),
        db.prepare("SELECT * FROM audit ORDER BY at DESC LIMIT 8"),
      ]);
      return reply({
        generated_at: new Date().toISOString(),
        user: { email: user.email, name: user.displayName, admin: true },
        student: null,
        stats: {
          students: (
            data[0].results[0] as {
              n: number;
              blocked: number;
            }
          ).n,
          blocked:
            (
              data[0].results[0] as {
                n: number;
                blocked: number;
              }
            ).blocked ?? 0,
          events: (
            data[1].results[0] as {
              n: number;
              blocked: number;
            }
          ).n,
          attendance: (
            data[2].results[0] as {
              n: number;
              blocked: number;
            }
          ).n,
        },
        events: data[3].results,
        audit: data[4].results,
      });
    }
    const rows = student
      ? await db
          .prepare(
            "SELECT e.id,e.title,e.company,e.starts_at,e.ends_at,e.status,a.minutes,a.source FROM events e JOIN eligibility g ON g.event_id=e.id LEFT JOIN attendance a ON a.event_id=e.id AND a.crn=g.crn WHERE g.crn=? AND e.status <> 'draft' ORDER BY e.starts_at DESC LIMIT 100",
          )
          .bind(student.crn)
          .all()
      : { results: [] };
    return reply({
      generated_at: new Date().toISOString(),
      user: { email: user.email, name: user.displayName, admin: false },
      student,
      events: rows.results,
    });
  }
  return undefined;
}
