import { HttpError } from "@/lib/server";
import {
  reply,
  type PortalBody,
  type Student,
  type JoinRecord,
} from "@/lib/services/context";
import { dashboardHandler } from "@/lib/services/dashboard";
import { studentsHandler } from "@/lib/services/students";
import { eventsHandler } from "@/lib/services/events";
import { attendanceHandler } from "@/lib/services/attendance";
import { studentAttendance } from "@/lib/services/student";
import { z } from "zod";
import type { Actor } from "@/lib/auth/session";
import type { Database } from "@/lib/db/database";
export interface Dependencies {
  getActor: () => Promise<Actor>;
  getDatabase: () => Database;
}
const readActions = new Set([
  "dashboard",
  "roster",
  "event",
  "eligible_options",
  "attendance",
  "audit",
  "export",
]);
const writeActions = new Set([
  "join",
  "import_roster",
  "create_event",
  "update_event",
  "publish",
  "close",
  "block",
  "import_attendance",
]);
const bodySchema = z
  .object({
    action: z.string(),
    csv: z.string().max(1000000).optional(),
    confirm: z.boolean().optional(),
    event_id: z.string().max(100).optional(),
    confirm_controls: z.boolean().optional(),
    crn: z.string().max(30).optional(),
    blocked: z.boolean().optional(),
    title: z.string().optional(),
    company: z.string().optional(),
    starts_at: z.string().optional(),
    ends_at: z.string().optional(),
    meeting_url: z.string().optional(),
    crns: z.array(z.string()).max(5000).optional(),
  })
  .strict();
async function readBody(req: Request): Promise<PortalBody> {
  if (Number(req.headers.get("content-length") ?? 0) > 1100000)
    throw new HttpError(413, "File exceeds 1 MB.");
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "Request body is missing.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1100000) {
      await reader.cancel();
      throw new HttpError(413, "File exceeds 1 MB.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
  const result = bodySchema.safeParse(json);
  if (!result.success) throw new HttpError(400, "Invalid request fields.");
  return result.data;
}
export async function portalRequest(
  req: Request,
  write: boolean,
  dependencies: Dependencies,
) {
  try {
    const user = await dependencies.getActor(),
      db = dependencies.getDatabase(),
      url = new URL(req.url);
    if (
      write &&
      (req.headers.get("x-portal-request") !== "1" ||
        req.headers.get("origin") !==
          (process.env.NEXTAUTH_URL
            ? new URL(process.env.NEXTAUTH_URL).origin
            : url.origin))
    )
      throw new HttpError(403, "Request origin is not allowed.");
    if (
      write &&
      !req.headers.get("content-type")?.startsWith("application/json")
    )
      throw new HttpError(415, "Use application/json.");
    const body = write ? await readBody(req) : {};
    const action =
      (write ? body.action : url.searchParams.get("action")) ?? "dashboard";
    if (!(write ? writeActions : readActions).has(action))
      throw new HttpError(
        405,
        "This action is not allowed for this request method.",
      );
    if (
      [
        "join",
        "publish",
        "close",
        "import_attendance",
        "update_event",
      ].includes(action) &&
      !body.event_id
    )
      throw new HttpError(400, "Event ID is required.");
    if (["event", "export"].includes(action) && !url.searchParams.get("id"))
      throw new HttpError(400, "Event ID is required.");
    if (action === "block" && !body.crn)
      throw new HttpError(400, "CRN is required.");
    if (!user.admin && !["dashboard", "join", "attendance"].includes(action))
      throw new HttpError(403, "TNP administrator access required.");
    let student: Student | null = null;
    let joinRecord: JoinRecord | null = null;
    if (write) {
      const limit = action.startsWith("import")
        ? 10
        : action === "join"
          ? 60
          : 30;
      const window = Math.floor(Date.now() / 60000);
      const rate = db
        .prepare(
          "INSERT INTO rate_limits(identity,action,window_id,count) VALUES(?,?,?,1) ON CONFLICT(identity,action) DO UPDATE SET window_id=excluded.window_id,count=CASE WHEN rate_limits.window_id=excluded.window_id THEN rate_limits.count+1 ELSE 1 END RETURNING count",
        )
        .bind(user.userId, action, window);
      if (action === "join") {
        // One indexed read checks identity, suspension, eligibility, and event state.
        const read = db
          .prepare(
            "SELECT e.id,e.status,e.starts_at,e.ends_at,e.meeting_url,s.crn student_crn,s.blocked student_blocked,CASE WHEN g.crn IS NOT NULL THEN 1 ELSE 0 END eligible FROM events e LEFT JOIN students s ON s.email=? LEFT JOIN eligibility g ON g.event_id=e.id AND g.crn=s.crn WHERE e.id=?",
          )
          .bind(user.email, body.event_id);
        const results = await db.batch([rate, read]);
        if ((results[0].results[0] as { count: number }).count > limit)
          throw new HttpError(
            429,
            "Too many requests. Wait a minute and retry.",
          );
        joinRecord = (results[1].results[0] as unknown as JoinRecord) ?? null;
      } else {
        const result = await rate.first<{ count: number }>();
        if (result && result.count > limit)
          throw new HttpError(
            429,
            "Too many requests. Wait a minute and retry.",
          );
      }
    }
    if (action !== "join")
      student = await db
        .prepare("SELECT * FROM students WHERE email=?")
        .bind(user.email)
        .first<Student>();
    const ctx = { user, db, url, body, student, action, joinRecord };
    if (!user.admin && action === "attendance") return studentAttendance(ctx);
    for (const handle of [
      dashboardHandler,
      studentsHandler,
      eventsHandler,
      attendanceHandler,
    ]) {
      const result = await handle(ctx);
      if (result) return result;
    }
    throw new HttpError(400, "Unknown action.");
  } catch (error) {
    if ((error as { code?: string })?.code === "23505")
      return reply(
        {
          error: "A duplicate identity or record was found. Refresh and retry.",
        },
        409,
      );
    if (error instanceof HttpError) {
      const response = reply({ error: error.message }, error.status);
      if (error.status === 429) response.headers.set("Retry-After", "60");
      return response;
    }
    if (
      error instanceof Error &&
      /Row |CSV|Duplicate|File exceeds|Add a header|Unclosed|Import at|Invalid CSV/.test(
        error.message,
      )
    )
      return reply({ error: error.message }, 400);
    console.error(
      JSON.stringify({
        event: "portal_request_failed",
        requestId: crypto.randomUUID(),
        code: (error as { code?: string })?.code ?? "unknown",
      }),
    );
    return reply(
      { error: "Unable to complete this request. Please retry." },
      503,
    );
  }
}
