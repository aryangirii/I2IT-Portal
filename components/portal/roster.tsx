"use client";
import { useState, useEffect } from "react";
import { Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { api, type Student } from "@/lib/portal-client";
import { Blank, Loading } from "./shared";
import { ImportDialog } from "./import-dialog";
interface RosterPage {
  rows: Student[];
  total: number;
  page: number;
}
export default function Roster({ onRefresh }: { onRefresh: () => void }) {
  const [data, setData] = useState<RosterPage | null>(null),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [importing, setImporting] = useState(false),
    [error, setError] = useState(""),
    [target, setTarget] = useState<Student | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setError("");
      api<RosterPage>("roster", undefined, { search, page: String(page) })
        .then((v) => {
          if (active) setData(v);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, page, revision]);
  function refresh() {
    setRevision((r) => r + 1);
    onRefresh();
  }
  async function changeAccess() {
    if (!target) return;
    setBusy(true);
    try {
      await api("block", { crn: target.crn, blocked: !target.blocked });
      setTarget(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h1>Student roster</h1>
          <p>Official identities and placement-event access.</p>
        </div>
        <Button onClick={() => setImporting(true)}>
          <Upload size={17} />
          Import CSV
        </Button>
      </div>
      <div className="panel">
        <div className="panel-toolbar">
          <div className="search-field">
            <Search size={17} />
            <Input
              placeholder="Search name, CRN or email"
              aria-label="Search student roster"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <span className="secondary-text">{data?.total ?? 0} students</span>
        </div>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        {!data ? (
          <Loading />
        ) : !data.rows.length ? (
          <Blank
            title="No students found"
            description={
              search
                ? "Try another name, CRN or email."
                : "Import the official student list to get started."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>CRN</TableHead>
                <TableHead>Department / batch</TableHead>
                <TableHead>Access</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((s) => (
                <TableRow key={s.crn}>
                  <TableCell>
                    <strong>{s.name}</strong>
                    <div className="secondary-text">{s.email}</div>
                  </TableCell>
                  <TableCell>
                    <code>{s.crn}</code>
                  </TableCell>
                  <TableCell>
                    {s.department}
                    <div className="secondary-text">Class of {s.batch}</div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        "status " + (s.blocked ? "suspended" : "active")
                      }
                    >
                      {s.blocked ? "Suspended" : "Active"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTarget(s)}
                    >
                      {s.blocked ? "Restore" : "Suspend"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {data && data.total > 50 && (
          <Pagination className="pagination">
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
              </PaginationItem>
              <PaginationItem>
                <span>
                  Page {page} of {Math.ceil(data.total / 50)}
                </span>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 50 >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
      <ImportDialog
        key={String(importing)}
        open={importing}
        onClose={() => setImporting(false)}
        onDone={refresh}
      />
      <AlertDialog
        open={!!target}
        onOpenChange={(v) => {
          if (!v && !busy) setTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target?.blocked ? "Restore" : "Suspend"} {target?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This changes access to meeting links through this portal. To block
              entry through a previously shared URL, update Google Meet
              invitations and host controls separately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void changeAccess();
              }}
            >
              {busy ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
