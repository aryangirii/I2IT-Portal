"use client";
import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import StudentProfile from "@/components/portal/student-profile";
import StudentOverview from "@/components/portal/student-overview";
import Image from "next/image";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  ClipboardCheck,
  History,
  ShieldCheck,
  Plus,
  RefreshCw,
  LogOut,
  Upload,
  FileCheck2,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { api, type Dashboard } from "@/lib/portal-client";
import { Loading, EventTable, Activity } from "@/components/portal/shared";
import dynamic from "next/dynamic";
const Roster = dynamic(() => import("@/components/portal/roster"));
const EventCreate = dynamic(() => import("@/components/portal/event-create"));
const EventDetail = dynamic(() => import("@/components/portal/event-detail"));
import { Attendance, Audit, AccessSetup } from "@/components/portal/records";
import { ImportDialog } from "@/components/portal/import-dialog";
type Section =
  | "overview"
  | "events"
  | "students"
  | "attendance"
  | "audit"
  | "setup"
  | "profile";
const menu = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "events", label: "Placement events", icon: CalendarDays },
  { id: "students", label: "Student roster", icon: Users },
  { id: "attendance", label: "Attendance", icon: ClipboardCheck },
  { id: "audit", label: "Activity log", icon: History },
  { id: "profile", label: "My profile", icon: Users },
  { id: "setup", label: "Access & setup", icon: ShieldCheck },
] as const;
export default function Portal() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null),
    [section, setSection] = useState<Section>("overview"),
    [error, setError] = useState(""),
    [refreshing, setRefreshing] = useState(true),
    [viewRevision, setViewRevision] = useState(0),
    [creating, setCreating] = useState(false),
    [importing, setImporting] = useState(false),
    [eventId, setEventId] = useState<string | null>(null),
    [join, setJoin] = useState<{
      url: string;
      email: string;
    } | null>(null),
    [joining, setJoining] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      setDashboard(await api<Dashboard>("dashboard"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    api<Dashboard>("dashboard")
      .then((value) => {
        if (active) setDashboard(value);
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function joinEvent(id: string) {
    setJoining(true);
    setError("");
    try {
      setJoin(await api("join", { event_id: id }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoining(false);
    }
  }
  const admin = dashboard?.user.admin ?? false;
  const visible = menu.filter((m) =>
    admin
      ? m.id !== "profile"
      : ["overview", "events", "attendance", "profile"].includes(m.id),
  );
  return (
    <SidebarProvider>
      <Sidebar className="portal-sidebar">
        <SidebarHeader className="college-brand">
          <Image
            unoptimized
            src="/college-logo.png"
            alt="I²IT Pune"
            width="54"
            height="70"
          />
          <div>
            <strong>I²IT Pune</strong>
            <span>Placement Desk</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>
              {admin ? "TNP WORKSPACE" : "STUDENT WORKSPACE"}
            </SidebarGroupLabel>
            <SidebarMenu>
              {visible.map((m) => (
                <SidebarMenuItem key={m.id}>
                  <SidebarMenuButton
                    isActive={section === m.id && !eventId}
                    onClick={() => {
                      setSection(m.id);
                      setEventId(null);
                    }}
                  >
                    <m.icon size={19} />
                    <span>{m.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="sidebar-pilot">
            <ShieldCheck size={19} />
            <div>
              <strong>Verified access</strong>
              <span>College roster permissions</span>
            </div>
          </div>
          <div className="sidebar-user">
            <div className="avatar">
              {dashboard?.user.name.charAt(0).toUpperCase() ?? "P"}
            </div>
            <div>
              <strong>{admin ? "TNP administrator" : "Student account"}</strong>
              <span>{dashboard?.user.email ?? "Loading account…"}</span>
            </div>
          </div>
          <button
            className="signout"
            onClick={() => void signOut({ callbackUrl: "/" })}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="portal-topbar">
          <div className="topbar-left">
            <SidebarTrigger />
            <span>Training & Placement</span>
            <span className="topbar-divider">/</span>
            <strong>
              {eventId
                ? "Event details"
                : menu.find((m) => m.id === section)?.label}
            </strong>
          </div>
          <div className="topbar-right">
            <span>Academic year 2026–27</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Refresh dashboard"
              disabled={refreshing}
              onClick={() => {
                setViewRevision((value) => value + 1);
                void refresh();
              }}
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
            </Button>
          </div>
        </header>
        <main className="portal-main" key={`${section}:${eventId ?? "list"}`}>
          {error && (
            <div className="error-box" role="alert">
              {error}
              <Button variant="ghost" onClick={() => void refresh()}>
                Retry
              </Button>
            </div>
          )}
          {joining && <p role="status">Checking your event eligibility…</p>}
          {!dashboard ? (
            refreshing ? (
              <Loading />
            ) : null
          ) : eventId && admin ? (
            <EventDetail
              key={`${eventId}:${viewRevision}`}
              id={eventId}
              onBack={() => {
                setEventId(null);
                setSection("events");
              }}
              onRefresh={() => void refresh()}
            />
          ) : section === "students" && admin ? (
            <Roster key={viewRevision} onRefresh={() => void refresh()} />
          ) : section === "profile" && !admin ? (
            <StudentProfile dashboard={dashboard} />
          ) : section === "attendance" ? (
            <Attendance key={viewRevision} admin={admin} />
          ) : section === "audit" && admin ? (
            <Audit key={viewRevision} />
          ) : section === "setup" && admin ? (
            <AccessSetup />
          ) : (
            <>
              <div
                className={
                  section === "overview"
                    ? "section-heading overview-heading"
                    : "section-heading"
                }
              >
                <div>
                  <p className="eyebrow">
                    {admin
                      ? "TRAINING & PLACEMENT OFFICE"
                      : (dashboard.student?.crn ?? "STUDENT ACCOUNT")}
                  </p>
                  <h1>
                    {section === "events"
                      ? "Placement events"
                      : admin
                        ? "Placement overview"
                        : `Welcome, ${dashboard.student?.name ?? dashboard.user.name}`}
                  </h1>
                  <p>
                    {admin
                      ? "Manage eligible students, meeting access, and attendance."
                      : "Your assigned placement events and participation records."}
                  </p>
                </div>
                {admin && (
                  <Button onClick={() => setCreating(true)}>
                    <Plus size={18} />
                    Create event
                  </Button>
                )}
              </div>
              {!admin && !dashboard.student && (
                <div className="notice">
                  <ShieldCheck size={22} />
                  <div>
                    <strong>Your email is not on the roster yet.</strong>
                    <p>
                      Contact TNP with your CRN and this email:{" "}
                      {dashboard.user.email}. You cannot join events until your
                      identity is approved.
                    </p>
                  </div>
                </div>
              )}
              {!admin && Boolean(dashboard.student?.blocked) && (
                <p className="error-box">
                  Your portal access is suspended. Contact TNP before joining an
                  event.
                </p>
              )}
              {section === "overview" && !admin && (
                <StudentOverview dashboard={dashboard} />
              )}
              {section === "overview" && admin && (
                <>
                  <div className="metrics">
                    <div>
                      <span>Registered students</span>
                      <strong>
                        {dashboard.stats?.students.toLocaleString() ?? 0}
                      </strong>
                      <small>Official CRN & email roster</small>
                      <Users size={22} />
                    </div>
                    <div>
                      <span>Placement events</span>
                      <strong>{dashboard.stats?.events ?? 0}</strong>
                      <small>Drafts, published & closed</small>
                      <CalendarDays size={22} />
                    </div>
                    <div>
                      <span>Attendance records</span>
                      <strong>
                        {dashboard.stats?.attendance.toLocaleString() ?? 0}
                      </strong>
                      <small>Imported meeting participation</small>
                      <ClipboardCheck size={22} />
                    </div>
                    <div>
                      <span>Suspended accounts</span>
                      <strong>{dashboard.stats?.blocked ?? 0}</strong>
                      <small>Portal joining restricted</small>
                      <ShieldCheck size={22} />
                    </div>
                  </div>
                  {!dashboard.stats?.students && (
                    <div className="getting-started">
                      <div>
                        <span className="step-number">01</span>
                        <div>
                          <h2>Start with your student roster</h2>
                          <p>
                            Import CRNs and approved emails, then create the
                            first placement event.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setImporting(true)}
                      >
                        <Upload size={17} />
                        Import roster
                      </Button>
                    </div>
                  )}
                </>
              )}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      {section === "overview"
                        ? "Placement events"
                        : "All assigned events"}
                    </h2>
                    <p>
                      {admin
                        ? "Latest 100 events · Google Meet"
                        : "Joining opens 15 minutes before the session."}
                    </p>
                  </div>
                  {section === "overview" && (
                    <Button
                      variant="ghost"
                      onClick={() => setSection("events")}
                    >
                      View all
                    </Button>
                  )}
                </div>
                <EventTable
                  events={dashboard.events}
                  admin={admin}
                  busy={joining}
                  onOpen={setEventId}
                  onJoin={(id) => void joinEvent(id)}
                />
              </section>
              {section === "overview" && admin && (
                <div className="overview-lower">
                  <section className="panel padded">
                    <div className="panel-heading compact">
                      <h2>Recent activity</h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSection("audit")}
                      >
                        View log
                      </Button>
                    </div>
                    <Activity rows={dashboard.audit ?? []} />
                  </section>
                  <section className="panel padded workflow-card dark-panel">
                    <FileCheck2 size={24} />
                    <h2>One identity, clear records</h2>
                    <p>
                      Each approved email maps to a CRN. Event access is checked
                      separately from meeting attendance.
                    </p>
                    <dl>
                      <div>
                        <dt>Access</dt>
                        <dd>Checked by the portal</dd>
                      </div>
                      <div>
                        <dt>Meeting entry</dt>
                        <dd>Controlled by Google Meet</dd>
                      </div>
                      <div>
                        <dt>Attendance</dt>
                        <dd>Imported from meeting reports</dd>
                      </div>
                    </dl>
                    <Button
                      variant="outline"
                      onClick={() => setSection("setup")}
                    >
                      Review access setup
                    </Button>
                  </section>
                </div>
              )}
            </>
          )}
        </main>
        <footer className="portal-footer">
          <span>I²IT Pune · Training & Placement</span>
          <span>Placement Desk · Times shown in IST</span>
        </footer>
      </SidebarInset>
      {admin && creating && (
        <EventCreate
          open={creating}
          onClose={() => setCreating(false)}
          onDone={() => void refresh()}
        />
      )}
      <ImportDialog
        key={String(importing)}
        open={importing}
        onClose={() => setImporting(false)}
        onDone={() => void refresh()}
      />
      <Dialog
        open={!!join}
        onOpenChange={(v) => {
          if (!v) setJoin(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ready to open Google Meet</DialogTitle>
            <DialogDescription>
              Use {join?.email} in Google Meet. The meeting host’s account
              restrictions determine entry.
            </DialogDescription>
          </DialogHeader>
          <p>
            Opening the link is an access record. TNP imports actual attendance
            after the session.
          </p>
          <a
            className="primary-link"
            href={join?.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setJoin(null)}
          >
            Open Google Meet
          </a>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
