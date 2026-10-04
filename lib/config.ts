import { z } from "zod";
const schema = z.object({
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => /^postgres(?:ql)?:/.test(v)),
  TNP_ADMIN_EMAILS: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
});
export function serverConfig() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success)
    throw new Error(
      "Server configuration incomplete: " +
        parsed.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  const origin = new URL(parsed.data.NEXTAUTH_URL);
  if (process.env.NODE_ENV === "production" && origin.protocol !== "https:")
    throw new Error("Production requires an HTTPS application URL.");
  if (process.env.NODE_ENV === "production") {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
      throw new Error("Production requires Google OAuth credentials.");
    const databaseUrl = new URL(parsed.data.DATABASE_URL);
    if (databaseUrl.searchParams.get("sslmode") !== "verify-full")
      throw new Error("Production database URL must use sslmode=verify-full.");
    if (process.env.LOCAL_DEMO_ENABLED === "true")
      throw new Error("Disable demonstration accounts before deploying.");
  }
  return parsed.data;
}
export function demoEnabled() {
  const url = process.env.NEXTAUTH_URL ?? "";
  return (
    process.env.NODE_ENV !== "production" &&
    !process.env.VERCEL &&
    process.env.LOCAL_DEMO_ENABLED === "true" &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url) &&
    (process.env.LOCAL_DEMO_PASSWORD?.length ?? 0) >= 16
  );
}
export function adminEmails() {
  return (process.env.TNP_ADMIN_EMAILS ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}
