export interface Student {
  crn: string;
  name: string;
  email: string;
  department: string;
  batch: string;
  blocked: number;
}
export interface PlacementEvent {
  id: string;
  title: string;
  company: string;
  starts_at: string;
  ends_at: string;
  status: "draft" | "published" | "closed";
  eligible_count?: number;
  minutes?: number;
  source?: string;
  meeting_url?: string;
}
export interface AuditRecord {
  id: string;
  actor: string;
  action: string;
  detail: string;
  at: string;
}
export interface AttendanceRecord {
  id: string;
  event_id: string;
  crn: string;
  name?: string;
  email?: string;
  title?: string;
  company?: string;
  joined_at: string;
  left_at: string;
  minutes: number;
  source: string;
}
export interface AccessRecord {
  id: string;
  crn: string | null;
  email: string;
  decision: string;
  reason: string;
  at: string;
}
export interface Dashboard {
  generated_at: string;
  user: {
    email: string;
    name: string;
    admin: boolean;
  };
  student: Student | null;
  stats?: {
    students: number;
    blocked: number;
    events: number;
    attendance: number;
  };
  events: PlacementEvent[];
  audit?: AuditRecord[];
}
export async function api<T>(
  action: string,
  body?: Record<string, unknown>,
  params: Record<string, string> = {},
): Promise<T> {
  const query = new URLSearchParams({ action, ...params });
  const response = await fetch("/api/portal?" + query, {
    method: body ? "POST" : "GET",
    headers: body
      ? { "Content-Type": "application/json", "X-Portal-Request": "1" }
      : undefined,
    body: body ? JSON.stringify({ action, ...body }) : undefined,
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof result === "object" && result !== null && "error" in result
        ? String(result.error)
        : "Request failed.";
    throw new Error(message);
  }
  return result as T;
}
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
export const dateOnly = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
export async function readFile(file: File) {
  if (file.size > 1000000)
    throw new Error("Choose a CSV file smaller than 1 MB.");
  if (!file.name.toLowerCase().endsWith(".csv"))
    throw new Error("Choose a CSV file. Export Excel sheets as CSV first.");
  return file.text();
}
