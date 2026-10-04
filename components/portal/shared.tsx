"use client";
import type { ReactNode } from "react";
import { CalendarDays, FileCheck2, Inbox } from "lucide-react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import type { PlacementEvent, AuditRecord } from "@/lib/portal-client";
import { dateTime, dateOnly } from "@/lib/portal-client";
export function Blank({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="blank-state">
      <Inbox size={32} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="space-y-5" aria-label="Loading">
      <Skeleton className="h-12 w-1/3" />
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-60 w-full" />
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={"status " + value}>
      {value === "published"
        ? "Published"
        : value === "closed"
          ? "Closed"
          : value === "draft"
            ? "Draft"
            : value}
    </span>
  );
}
export function EventTable({
  events,
  admin,
  onOpen,
  onJoin,
  busy = false,
}: {
  events: PlacementEvent[];
  admin: boolean;
  onOpen: (id: string) => void;
  onJoin: (id: string) => void;
  busy?: boolean;
}) {
  if (!events.length)
    return (
      <Blank
        title={admin ? "No events yet" : "No events assigned"}
        description={
          admin
            ? "Import the student roster, then create your first placement event."
            : "Your eligible events will appear here after TNP adds you to an event."
        }
      />
    );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event & company</TableHead>
          <TableHead>Schedule · IST</TableHead>
          <TableHead>{admin ? "Eligible students" : "Attendance"}</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((e) => (
          <TableRow key={e.id}>
            <TableCell>
              <div className="event-name">{e.title}</div>
              <div className="secondary-text">{e.company}</div>
            </TableCell>
            <TableCell>
              <span className="flex items-center gap-2">
                <CalendarDays size={15} />
                {dateOnly(e.starts_at)}
              </span>
              <div className="secondary-text">
                {dateTime(e.starts_at).split(",").slice(1).join(",")}
              </div>
            </TableCell>
            <TableCell>
              {admin
                ? (e.eligible_count ?? 0)
                : e.minutes !== null && e.minutes !== undefined
                  ? `${e.minutes} min`
                  : "Awaiting report"}
            </TableCell>
            <TableCell>
              <Status value={e.status} />
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="outline"
                size="sm"
                onClick={() => (admin ? onOpen(e.id) : onJoin(e.id))}
                disabled={!admin && (busy || e.status !== "published")}
              >
                {admin ? "Manage" : "Join meeting"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
export function Activity({ rows }: { rows: AuditRecord[] }) {
  return rows.length ? (
    <div className="activity-list">
      {rows.map((a) => (
        <div className="activity" key={a.id}>
          <div className="activity-icon">
            <FileCheck2 size={18} />
          </div>
          <div>
            <strong>{a.action}</strong>
            <p>{a.detail}</p>
            <span>
              {dateTime(a.at)} · {a.actor}
            </span>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <p className="empty-inline">
      Roster imports and event changes will appear here.
    </p>
  );
}

export function Pager({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total <= 50) return null;
  return (
    <Pagination className="pagination">
      <PaginationContent>
        <PaginationItem>
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => onChange(page - 1)}
          >
            Previous
          </Button>
        </PaginationItem>
        <PaginationItem>
          <span>
            Page {page} of {Math.ceil(total / 50)}
          </span>
        </PaginationItem>
        <PaginationItem>
          <Button
            variant="outline"
            size="sm"
            disabled={page * 50 >= total}
            onClick={() => onChange(page + 1)}
          >
            Next
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
