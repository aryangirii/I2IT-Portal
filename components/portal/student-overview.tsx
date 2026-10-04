import type { Dashboard } from "@/lib/portal-client";
import { CalendarDays, ClipboardCheck, ShieldCheck } from "lucide-react";
export default function StudentOverview({
  dashboard,
}: {
  dashboard: Dashboard;
}) {
  const upcoming = dashboard.events.filter(
    (e) =>
      e.status === "published" &&
      Date.parse(e.ends_at) > Date.parse(dashboard.generated_at),
  ).length;
  const recorded = dashboard.events.filter(
    (e) => e.minutes !== null && e.minutes !== undefined,
  ).length;
  return (
    <div className="metrics student-metrics">
      <div>
        <span>Upcoming sessions</span>
        <strong>{upcoming}</strong>
        <small>Assigned by TNP</small>
        <CalendarDays size={22} />
      </div>
      <div>
        <span>Attendance recorded</span>
        <strong>{recorded}</strong>
        <small>Verified meeting reports</small>
        <ClipboardCheck size={22} />
      </div>
      <div>
        <span>Identity status</span>
        <strong className="text-status">
          {!dashboard.student
            ? "Pending"
            : dashboard.student.blocked
              ? "Suspended"
              : "Approved"}
        </strong>
        <small>{dashboard.student?.crn ?? "Contact TNP for approval"}</small>
        <ShieldCheck size={22} />
      </div>
    </div>
  );
}
