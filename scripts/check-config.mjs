// Prints field names and status only. Never prints credentials or connection URLs.
const required = [
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "DATABASE_URL",
  "TNP_ADMIN_EMAILS",
];
const errors = [];
for (const name of required) {
  const ok = Boolean(process.env[name]);
  console.log(name, ok ? "set" : "MISSING");
  if (!ok) errors.push(name);
}
if ((process.env.NEXTAUTH_SECRET?.length ?? 0) < 32)
  errors.push("NEXTAUTH_SECRET must contain at least 32 characters");
const demo = process.env.LOCAL_DEMO_ENABLED === "true";
if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
  if (!process.env.NEXTAUTH_URL?.startsWith("https://"))
    errors.push("Production needs HTTPS");
  if (
    process.env.DATABASE_URL &&
    new URL(process.env.DATABASE_URL).searchParams.get("sslmode") !==
      "verify-full"
  )
    errors.push("Production DATABASE_URL must use sslmode=verify-full");
  if (demo) errors.push("Disable LOCAL_DEMO_ENABLED before deployment");
}
if (
  !demo &&
  (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
)
  errors.push("Google OAuth credentials required");
if (demo && (process.env.LOCAL_DEMO_PASSWORD?.length ?? 0) < 16)
  errors.push("Local demo password must contain at least 16 characters");
if (errors.length) {
  console.error("Configuration needs attention:", errors.join(", "));
  process.exitCode = 1;
} else console.log("Configuration checks passed.");
