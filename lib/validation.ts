import { z } from "zod";
export const studentSchema = z.object({
  crn: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,30}$/),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  department: z.string().trim().min(1).max(100),
  batch: z.string().trim().min(1).max(20),
});
export const eventSchema = z
  .object({
    title: z.string().trim().min(3).max(150),
    company: z.string().trim().min(2).max(100),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
    meeting_url: z
      .string()
      .url()
      .refine((v) => {
        try {
          const u = new URL(v);
          return (
            u.protocol === "https:" &&
            u.hostname === "meet.google.com" &&
            /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(u.pathname) &&
            !u.username &&
            !u.password &&
            !u.search &&
            !u.hash
          );
        } catch {
          return false;
        }
      }, "Use a Google Meet URL like https://meet.google.com/abc-defg-hij"),
    crns: z.array(z.string().max(30)).min(1).max(5000),
  })
  .refine(
    (v) => Date.parse(v.ends_at) > Date.parse(v.starts_at),
    "End time must be after start time.",
  );
export function validateRoster(rows: Record<string, string>[]) {
  const result = rows.map((r, i) => {
    const p = studentSchema.safeParse(r);
    if (!p.success)
      throw new Error(
        `Row ${i + 2}: ${p.error.issues[0].path.join(".")} is invalid.`,
      );
    return p.data;
  });
  const crns = new Set(),
    emails = new Set();
  for (const r of result) {
    if (crns.has(r.crn) || emails.has(r.email))
      throw new Error("Duplicate CRN or email in this file.");
    crns.add(r.crn);
    emails.add(r.email);
  }
  return result;
}
