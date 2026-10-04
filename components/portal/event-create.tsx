"use client";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { api, type Student, type PlacementEvent } from "@/lib/portal-client";
export default function EventCreate({
  open,
  onClose,
  onDone,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  existing?: { event: PlacementEvent; students: Student[] };
}) {
  const [students, setStudents] = useState<Student[]>([]),
    [chosen, setChosen] = useState<Set<string>>(new Set()),
    [department, setDepartment] = useState("all"),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      let active = true;
      api<Student[]>("eligible_options")
        .then((value) => {
          if (active) {
            setStudents(value);
            setChosen(
              new Set(
                existing?.students
                  .filter((s) => !s.blocked)
                  .map((s) => s.crn) ?? [],
              ),
            );
            setDepartment("all");
            setSearch("");
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
      return () => {
        active = false;
      };
    }
  }, [open, existing]);
  const filtered = students.filter(
    (s) =>
      (department === "all" || s.department === department) &&
      `${s.crn} ${s.name} ${s.email}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(existing ? "update_event" : "create_event", {
        ...(existing ? { event_id: existing.event.id } : {}),
        title: form.get("title"),
        company: form.get("company"),
        meeting_url: form.get("meeting_url"),
        starts_at: new Date(
          String(form.get("starts_at")) + ":00+05:30",
        ).toISOString(),
        ends_at: new Date(
          String(form.get("ends_at")) + ":00+05:30",
        ).toISOString(),
        crns: [...chosen],
      });
      setChosen(new Set());
      onDone();
      onClose();
    } catch (err) {
      setError((err as Error).message);
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit placement event" : "Create placement event"}
          </DialogTitle>
          <DialogDescription>
            New and edited events require publishing. Review invitations and
            Google Meet access restrictions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="form-stack">
          <label>
            Event title
            <Input
              name="title"
              defaultValue={existing?.event.title}
              required
              minLength={3}
              maxLength={150}
              placeholder="Pre-placement talk"
            />
          </label>
          <label>
            Company
            <Input
              name="company"
              defaultValue={existing?.event.company}
              required
              minLength={2}
              maxLength={100}
              placeholder="Company name"
            />
          </label>
          <div className="form-grid">
            <label>
              Start · IST
              <Input
                type="datetime-local"
                name="starts_at"
                defaultValue={
                  existing
                    ? new Date(
                        Date.parse(existing.event.starts_at) + 330 * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : undefined
                }
                required
              />
            </label>
            <label>
              End · IST
              <Input
                type="datetime-local"
                name="ends_at"
                defaultValue={
                  existing
                    ? new Date(Date.parse(existing.event.ends_at) + 330 * 60000)
                        .toISOString()
                        .slice(0, 16)
                    : undefined
                }
                required
              />
            </label>
          </div>
          <label>
            Google Meet link
            <Input
              name="meeting_url"
              defaultValue={existing?.event.meeting_url}
              type="url"
              required
              placeholder="https://meet.google.com/abc-defg-hij"
            />
          </label>
          <div className="selection-heading">
            <strong>Eligible students</strong>
            <span>{chosen.size} selected</span>
          </div>
          <div className="form-grid">
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger
                className="w-full"
                aria-label="Filter by department"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {[...new Set(students.map((s) => s.department))]
                  .sort()
                  .map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search students"
              aria-label="Search eligible students"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="selection-actions">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setChosen(new Set([...chosen, ...filtered.map((s) => s.crn)]))
              }
            >
              Select {filtered.length} matching
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setChosen(new Set())}
            >
              Clear selection
            </Button>
          </div>
          <div className="student-picker">
            {filtered.slice(0, 50).map((s) => (
              <label key={s.crn} className="student-choice">
                <Checkbox
                  checked={chosen.has(s.crn)}
                  onCheckedChange={(v) =>
                    setChosen((old) => {
                      const next = new Set(old);
                      if (v === true) next.add(s.crn);
                      else next.delete(s.crn);
                      return next;
                    })
                  }
                />
                <span>
                  <strong>{s.name}</strong>
                  <small>
                    {s.crn} · {s.department}
                  </small>
                </span>
              </label>
            ))}
            {!filtered.length && (
              <p>Import the roster first, or change your filters.</p>
            )}
            {filtered.length > 50 && (
              <p className="secondary-text">
                Showing the first 50. Use search or select all matching
                students.
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button disabled={busy || !chosen.size}>
              {busy ? "Saving…" : existing ? "Save as draft" : "Create draft"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
