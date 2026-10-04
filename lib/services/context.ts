import type { Database } from "@/lib/db/database";
import type { actor } from "@/lib/server";
export interface Student {
  crn: string;
  name: string;
  email: string;
  department: string;
  batch: string;
  blocked: number;
  created_at: string;
}
export interface PortalBody {
  action?: string;
  csv?: string;
  confirm?: boolean;
  event_id?: string;
  confirm_controls?: boolean;
  crn?: string;
  blocked?: boolean;
  title?: string;
  company?: string;
  starts_at?: string;
  ends_at?: string;
  meeting_url?: string;
  crns?: string[];
}
export interface JoinRecord {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  meeting_url: string;
  student_crn: string | null;
  student_blocked: number | null;
  eligible: number;
}
export interface RequestContext {
  user: Awaited<ReturnType<typeof actor>>;
  db: Database;
  url: URL;
  body: PortalBody;
  student: Student | null;
  action: string;
  joinRecord: JoinRecord | null;
}
export const reply = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
