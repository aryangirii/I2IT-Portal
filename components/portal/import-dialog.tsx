"use client";
import { useState } from "react";
import { Upload, Download, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { api, downloadText, readFile } from "@/lib/portal-client";
interface Preview {
  count: number;
  rows: Record<string, unknown>[];
}
export function ImportDialog({
  open,
  onClose,
  eventId,
  onDone,
  attendanceTemplate,
}: {
  open: boolean;
  onClose: () => void;
  eventId?: string;
  onDone: () => void;
  attendanceTemplate?: { email: string; joinedAt: string; leftAt: string };
}) {
  const [csv, setCsv] = useState(""),
    [fileName, setFileName] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const attendance = Boolean(eventId);
  const action = attendance ? "import_attendance" : "import_roster";
  async function validate(file: File) {
    setError("");
    setBusy(true);
    setPreview(null);
    try {
      const text = await readFile(file);
      setCsv(text);
      setFileName(file.name);
      setPreview(
        await api<Preview>(action, {
          csv: text,
          ...(eventId ? { event_id: eventId } : {}),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await api(action, {
        csv,
        confirm: true,
        ...(eventId ? { event_id: eventId } : {}),
      });
      setPreview(null);
      setCsv("");
      onDone();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        {!attendance && (
          <div className="flex gap-3 text-sm">
            <a className="text-link" href="/samples/students-20.csv" download>
              20-student sample
            </a>
            <a className="text-link" href="/samples/students-500.csv" download>
              500-student sample
            </a>
          </div>
        )}
        <DialogHeader>
          <DialogTitle>
            {attendance ? "Import attendance report" : "Import student roster"}
          </DialogTitle>
          <DialogDescription>
            {attendance
              ? "Use a TNP-approved meeting report converted to the template below. Repeated sessions are combined without double-counting overlap."
              : "Map every student to their official CRN and approved email. Existing identity mappings cannot be overwritten."}
          </DialogDescription>
        </DialogHeader>
        <div className="import-guide">
          <Download size={18} />
          <div>
            <strong>Start with the CSV template</strong>
            <p>
              {attendance
                ? "Columns: email, joined_at, left_at. Use ISO timestamps with a timezone."
                : "Columns: crn, name, email, department, batch."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadText(
                attendance
                  ? "attendance-template.csv"
                  : "student-roster-template.csv",
                attendance
                  ? `email,joined_at,left_at\n${attendanceTemplate?.email ?? "student@example.com"},${attendanceTemplate?.joinedAt ?? "2026-10-04T10:00:00+05:30"},${attendanceTemplate?.leftAt ?? "2026-10-04T11:00:00+05:30"}\n`
                  : "crn,name,email,department,batch\nC23222,Sample Student,student@example.com,Computer Engineering,2027\n",
              )
            }
          >
            Download
          </Button>
        </div>
        <label className="upload-box">
          <Upload size={25} />
          <strong>{fileName || "Choose a CSV file"}</strong>
          <span>Up to 5,000 rows · Maximum 1 MB</span>
          <Input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            aria-label="Upload CSV file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void validate(f);
            }}
          />
        </label>
        {busy && <p role="status">Processing your file…</p>}
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        {preview && (
          <>
            <p className="success-line">
              <CheckCircle2 size={18} />
              {preview.count} valid{" "}
              {attendance ? "attendance records" : "students"} · Preview of
              first 10
            </p>
            <div className="preview-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(preview.rows[0] ?? {})
                      .filter((k) => k !== "intervals")
                      .map((k) => (
                        <TableHead key={k}>{k}</TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row, i) => (
                    <TableRow key={i}>
                      {Object.entries(row)
                        .filter(([k]) => k !== "intervals")
                        .map(([k, v]) => (
                          <TableCell key={k}>{String(v)}</TableCell>
                        ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        <div className="dialog-actions">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!preview || busy}>
            {busy
              ? "Saving…"
              : `Import ${preview?.count ?? ""} ${attendance ? "records" : "students"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
