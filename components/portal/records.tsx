"use client";
import { useEffect, useState } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  api,
  dateTime,
  type AttendanceRecord,
  type AuditRecord,
} from "@/lib/portal-client";
import { Activity, Blank, Loading } from "./shared";
export function Attendance({ admin }: { admin: boolean }) {
  const [rows, setRows] = useState<AttendanceRecord[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<AttendanceRecord[]>("attendance")
      .then((v) => {
        if (active) setRows(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <div className="section-heading">
        <div>
          <h1>Attendance records</h1>
          <p>
            {admin
              ? "Latest 100 imported records. Open an event for its complete report and CSV export."
              : "Your latest 100 participation records, imported by TNP from meeting reports."}
          </p>
        </div>
      </div>
      <div className="panel">
        {error ? (
          <p className="error-box" role="alert">
            {error}
          </p>
        ) : !rows ? (
          <Loading />
        ) : !rows.length ? (
          <Blank
            title="No attendance recorded"
            description="TNP can import meeting attendance after a session. Clicking Join is recorded separately."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student / CRN</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Joined · IST</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    {a.name ?? a.crn}
                    <div className="secondary-text">{a.crn}</div>
                  </TableCell>
                  <TableCell>
                    {a.title}
                    <div className="secondary-text">{a.company}</div>
                  </TableCell>
                  <TableCell>{dateTime(a.joined_at)}</TableCell>
                  <TableCell>{a.minutes} min</TableCell>
                  <TableCell>{a.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
export function Audit() {
  const [rows, setRows] = useState<AuditRecord[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<AuditRecord[]>("audit")
      .then((v) => {
        if (active) setRows(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <div className="section-heading">
        <div>
          <h1>Activity log</h1>
          <p>Latest 100 administrative actions, with actor and timestamp.</p>
        </div>
      </div>
      <div className="panel padded">
        {error ? (
          <p className="error-box" role="alert">
            {error}
          </p>
        ) : rows ? (
          <Activity rows={rows} />
        ) : (
          <Loading />
        )}
      </div>
    </>
  );
}
export function AccessSetup() {
  return (
    <>
      <div className="section-heading">
        <div>
          <h1>Access & setup</h1>
          <p>Identity, student access and meeting responsibilities.</p>
        </div>
      </div>
      <div className="setup-grid">
        <section className="panel padded">
          <span className="status active">Enabled</span>
          <h2>Portal protection</h2>
          <ul>
            <li>Verified Google sign-in with secure server sessions.</li>
            <li>Administrator access is granted by server configuration.</li>
            <li>Student emails map to official CRNs.</li>
            <li>Eligibility is checked for every Join request.</li>
            <li>Suspended accounts cannot receive meeting links.</li>
            <li>
              Write requests require the same origin and are rate limited.
            </li>
          </ul>
        </section>
        <section className="panel padded">
          <span className="status draft">Manual setup</span>
          <h2>Google Meet access</h2>
          <ul>
            <li>Invite approved emails to the Calendar event.</li>
            <li>
              Use Restricted access and disable requests from anyone with the
              link.
            </li>
            <li>Students must use their approved account in Meet.</li>
            <li>Apply microphone, chat, and screen-sharing controls.</li>
            <li>Remove or block disruptive participants in Meet.</li>
          </ul>
          <p>
            A portal suspension cannot revoke an existing Google Meet invitation
            automatically.
          </p>
        </section>
        <section className="panel padded">
          <span className="status draft">Before college rollout</span>
          <h2>College connections</h2>
          <ul>
            <li>Google sign-in requires the college OAuth credentials.</li>
            <li>
              Invitation syncing and automatic attendance retrieval are not
              connected.
            </li>
            <li>Attendance is imported from TNP-approved CSV reports.</li>
            <li>
              Video recording, transcripts, and chat storage are not included.
            </li>
            <li>Agree retention, recovery, and support procedures with TNP.</li>
            <li>
              Complete a live pilot and deployed-load test before inviting the
              full batch.
            </li>
          </ul>
        </section>
        <section className="panel padded">
          <h2>Import rules</h2>
          <p>
            CSV files support up to 5,000 rows and 1 MB per upload. Export Excel
            sheets to CSV before importing.
          </p>
          <p>
            CRNs and emails are unique. Identity changes require administrator
            review. Attendance timestamps must include their timezone and match
            the selected event.
          </p>
          <p>Times shown throughout the portal use India Standard Time.</p>
        </section>
      </div>
    </>
  );
}
