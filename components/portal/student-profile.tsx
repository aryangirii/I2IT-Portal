import type { Dashboard } from "@/lib/portal-client";
export default function StudentProfile({
  dashboard,
}: {
  dashboard: Dashboard;
}) {
  const s = dashboard.student;
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">STUDENT WORKSPACE</p>
          <h1>My profile</h1>
          <p>Your identity is maintained by the Training & Placement office.</p>
        </div>
      </div>
      <section className="panel padded profile-card">
        <h2>{s?.name ?? dashboard.user.name}</h2>
        <span className={"status " + (s && !s.blocked ? "active" : "closed")}>
          {!s
            ? "Awaiting approval"
            : s.blocked
              ? "Suspended"
              : "Approved identity"}
        </span>
        <dl>
          {[
            ["CRN", s?.crn ?? "Not assigned"],
            ["Approved email", dashboard.user.email],
            ["Department", s?.department ?? "Not assigned"],
            ["Graduating batch", s?.batch ?? "Not assigned"],
          ].map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="note">
          For corrections, contact TNP with your CRN. Changing your Google
          display name does not change your official student record.
        </p>
      </section>
    </>
  );
}
