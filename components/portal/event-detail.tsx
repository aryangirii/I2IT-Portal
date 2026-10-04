"use client";
import { useState, useEffect } from "react";
import { Download, Upload, Video, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  api,
  dateTime,
  type PlacementEvent,
  type Student,
  type AttendanceRecord,
  type AccessRecord,
} from "@/lib/portal-client";
import { Blank, Loading, Status, Pager } from "./shared";
import { ImportDialog } from "./import-dialog";
import EventCreate from "./event-create";
interface Detail {
  event: PlacementEvent;
  students: Student[];
  attendance: AttendanceRecord[];
  access: AccessRecord[];
}
export default function EventDetail({
  id,
  onBack,
  onRefresh,
}: {
  id: string;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [importing, setImporting] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [closing, setClosing] = useState(false),
    [editing, setEditing] = useState(false),
    [copied, setCopied] = useState(false),
    [studentsPage, setStudentsPage] = useState(1),
    [attendancePage, setAttendancePage] = useState(1);
  useEffect(() => {
    let active = true;
    api<Detail>("event", undefined, { id })
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, revision]);
  function refresh() {
    setRevision((r) => r + 1);
    onRefresh();
  }
  async function update(action: "publish" | "close") {
    setBusy(true);
    setError("");
    try {
      await api(action, { event_id: id, confirm_controls: confirmed });
      setClosing(false);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <>
        {error ? (
          <p role="alert" className="error-box">
            {error}
          </p>
        ) : (
          <Loading />
        )}
        <Button variant="outline" onClick={onBack}>
          Back to events
        </Button>
      </>
    );
  const e = data.event;
  return (
    <>
      <Button variant="ghost" onClick={onBack} className="back-button">
        Back to events
      </Button>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{e.company}</p>
          <h1>{e.title}</h1>
          <p>
            {dateTime(e.starts_at)} – {dateTime(e.ends_at)} · IST
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <Status value={e.status} />
          {e.status !== "closed" && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit event & eligibility
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      <div className="event-summary">
        <div>
          <Video size={21} />
          <div>
            <strong>Google Meet</strong>
            <p>{e.meeting_url}</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(e.meeting_url ?? "");
              setCopied(true);
            } catch {
              setError("Unable to copy. Select the meeting URL above.");
            }
          }}
        >
          <Copy size={16} />
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      {e.status === "draft" && (
        <div className="panel readiness">
          <h2>Before you publish</h2>
          <ol>
            <li>
              Download the eligible list and invite those email accounts to the
              Google Calendar event.
            </li>
            <li>
              Set Google Meet access to Restricted and turn off requests from
              anyone with the link.
            </li>
            <li>
              Enable host management and review microphone, chat, and
              screen-sharing permissions.
            </li>
          </ol>
          <p>
            These settings are configured in Google Meet. This portal does not
            automatically apply or verify them.
          </p>
          <a
            className="text-link"
            href={
              "/api/portal?action=export&type=invites&id=" +
              encodeURIComponent(id)
            }
          >
            <Download size={16} />
            Download invitation list
          </a>
          <label className="checkbox-line">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)}
            />
            <span>
              I have invited the approved accounts and configured meeting
              restrictions.
            </span>
          </label>
          <Button
            disabled={!confirmed || busy}
            onClick={() => void update("publish")}
          >
            {busy ? "Publishing…" : "Publish event"}
          </Button>
        </div>
      )}
      <div className="panel">
        <Tabs defaultValue="students">
          <div className="detail-toolbar">
            <TabsList>
              <TabsTrigger value="students">
                Eligible ({data.students.length})
              </TabsTrigger>
              <TabsTrigger value="attendance">
                Attendance ({data.attendance.length})
              </TabsTrigger>
              <TabsTrigger value="access">Access records</TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImporting(true)}
            >
              <Upload size={15} />
              Import attendance
            </Button>
          </div>
          <TabsContent value="students">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>CRN</TableHead>
                  <TableHead>Approved email</TableHead>
                  <TableHead>Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.students
                  .slice((studentsPage - 1) * 50, studentsPage * 50)
                  .map((s) => (
                    <TableRow key={s.crn}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>
                        <code>{s.crn}</code>
                      </TableCell>
                      <TableCell>{s.email}</TableCell>
                      <TableCell>
                        <Status value={s.blocked ? "Suspended" : "Active"} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            <Pager
              page={studentsPage}
              total={data.students.length}
              onChange={setStudentsPage}
            />
          </TabsContent>
          <TabsContent value="attendance">
            {data.attendance.length ? (
              <>
                <div className="report-toolbar">
                  <p className="secondary-text">
                    Source: TNP report import. Link clicks are not attendance.
                  </p>
                  <a
                    className="text-link"
                    href={
                      "/api/portal?action=export&type=attendance&id=" +
                      encodeURIComponent(id)
                    }
                  >
                    <Download size={16} />
                    Export CSV
                  </a>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student / CRN</TableHead>
                      <TableHead>Joined · IST</TableHead>
                      <TableHead>Left · IST</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.attendance
                      .slice((attendancePage - 1) * 50, attendancePage * 50)
                      .map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            {a.name}
                            <div className="secondary-text">{a.crn}</div>
                          </TableCell>
                          <TableCell>{dateTime(a.joined_at)}</TableCell>
                          <TableCell>{dateTime(a.left_at)}</TableCell>
                          <TableCell>{a.minutes} min</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <Pager
                  page={attendancePage}
                  total={data.attendance.length}
                  onChange={setAttendancePage}
                />
              </>
            ) : (
              <Blank
                title="Attendance report pending"
                description="Import a meeting attendance report after the session. Opening a meeting link does not prove participation."
              />
            )}
          </TabsContent>
          <TabsContent value="access">
            {data.access.length ? (
              <>
                <p className="secondary-text access-note">
                  Latest 100 access decisions. Repeated attempts are grouped by
                  student and minute.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Time · IST</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.access.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          {a.email}
                          <div className="secondary-text">
                            {a.crn ?? "Not on roster"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Status value={a.decision} />
                        </TableCell>
                        <TableCell>{a.reason}</TableCell>
                        <TableCell>{dateTime(a.at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <Blank
                title="No access attempts yet"
                description="Student Join requests will appear here as allowed or denied."
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
      {e.status === "published" && (
        <div className="close-event">
          <p>
            Close portal joining after this session. This does not end the
            Google Meet call.
          </p>
          <Button variant="outline" onClick={() => setClosing(true)}>
            Close event
          </Button>
        </div>
      )}
      <EventCreate
        open={editing}
        onClose={() => setEditing(false)}
        onDone={refresh}
        existing={data}
      />
      <ImportDialog
        key={String(importing)}
        attendanceTemplate={{
          email: data.students[0]?.email ?? "student@example.com",
          joinedAt: e.starts_at,
          leftAt: e.ends_at,
        }}
        open={importing}
        onClose={() => setImporting(false)}
        eventId={id}
        onDone={refresh}
      />
      <AlertDialog open={closing} onOpenChange={setClosing}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this event?</AlertDialogTitle>
            <AlertDialogDescription>
              Students will no longer receive its meeting link through the
              portal. Existing Google Meet access is controlled separately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(ev) => {
                ev.preventDefault();
                void update("close");
              }}
            >
              {busy ? "Closing…" : "Close event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
