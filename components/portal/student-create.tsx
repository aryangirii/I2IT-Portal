"use client";
import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/portal-client";
const fields = [
  {
    key: "name",
    label: "Full name",
    type: "text",
    max: 100,
    autoComplete: "name",
  },
  {
    key: "crn",
    label: "College registration number (CRN)",
    type: "text",
    max: 30,
    autoComplete: "off",
  },
  {
    key: "email",
    label: "Google account email",
    type: "email",
    max: 254,
    autoComplete: "email",
  },
  {
    key: "department",
    label: "Department",
    type: "text",
    max: 100,
    autoComplete: "off",
  },
  {
    key: "batch",
    label: "Graduation year / batch",
    type: "text",
    max: 20,
    autoComplete: "off",
  },
] as const;
export function StudentCreate({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await api("create_student", {
        student: Object.fromEntries(
          fields.map(({ key }) => [key, String(data.get(key) ?? "").trim()]),
        ),
      });
      onDone();
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent className="student-create-dialog" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Add student</DialogTitle>
          <DialogDescription>
            Link an existing Google email to the student’s official CRN. Event
            eligibility is assigned separately.
          </DialogDescription>
        </DialogHeader>
        <form className="form-stack" onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy} className="student-fields">
            {fields.map(({ key, label, type, max, autoComplete }) => (
              <label key={key} htmlFor={"student-" + key}>
                {label}
                <Input
                  id={"student-" + key}
                  name={key}
                  type={type}
                  required
                  maxLength={max}
                  minLength={key === "name" ? 2 : key === "crn" ? 3 : 1}
                  autoComplete={autoComplete}
                  pattern={key === "crn" ? "[A-Za-z0-9-]{3,30}" : undefined}
                  aria-describedby={
                    key === "email" ? "student-email-help" : undefined
                  }
                />
              </label>
            ))}
          </fieldset>
          <p id="student-email-help" className="note">
            Use the exact email the student will select when signing in with
            Google.
          </p>
          {error && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Adding student…" : "Add student"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
