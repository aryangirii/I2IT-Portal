# Verification record — release 0.2.1

Validated on 4 October 2026 using Node.js 24.19.0 and Next.js 16.3.8.

| Check | Result |
|---|---|
| Functional/security integration checks | 40 passed against embedded PostgreSQL |
| HTTP checks with real NextAuth sessions | 17 passed through Next.js and node-postgres |
| TypeScript and Next.js route generation | Passed |
| ESLint | Passed |
| Optimized production build | Passed |
| Production dependency audit | 0 known vulnerabilities reported by npm audit --omit=dev |
| Concurrent admission test | 500 requests started together; 0 failed |
| Browser interaction/visual checks | Blocked by browser environment |
| Real Google OAuth exchange and Meet permissions | Pending college test accounts and host configuration |

Concurrency result: total 1126 ms, p50 979 ms, p95 1093 ms, p99 1107 ms. These are local admission-test timings against a single embedded database. They exclude hosted infrastructure, Google OAuth exchanges, browser rendering and media. They do not establish production capacity on Vercel or AWS.

The HTTP suite verifies login page/college logo/security headers, anonymous and spoofed-header rejection, incorrect demonstration passwords, public Google provider registration without exposing its secret, real session roles, roster preview/import, publishing, admission and outsider denial, attendance isolation, suspension/restoration in an existing session, exports, audit/access records, event/eligibility editing, cross-origin write rejection, closed-event protection, tampered-cookie rejection, health and sign-out. Google provider registration uses dummy test credentials and does not complete an OAuth exchange.

Integration checks additionally cover 5,000-student imports, joining time windows, verified-email rules, strict provider checks, transaction rollback, admission rate limiting, overlapping attendance intervals and repeat-import idempotency. Successful Join requests do not create attendance records.

Browser automation failed to initialize its daemon. Installing the test browser also failed certificate verification with UnknownIssuer. No browser interaction pass or visual-pass claim is made. The supplied user screenshots show the previous version running locally; they do not verify the new styles. Use docs/google-and-acceptance-testing.md to complete real-browser checks, including responsive dialogs, keyboard navigation and reduced motion.

Real Google login, Meet native restrictions, provider participant capacity and hosted database TLS require real configuration. They have not been exercised in this environment. Docker Desktop and Vercel deployment were not tested here.

Release changes: dark overview headers and workflow panel, restrained CSS transitions with reduced-motion opt-out, section-aware refresh, student-specific attendance instructions, safe sign-in error messages and an event-specific attendance template. Local Docker uses host port 5433; retain existing private environment values and database volumes during upgrade.

The production audit result is a point-in-time check, not a security guarantee. It excludes development tooling. The previously reported braces advisory in the ESLint dependency chain is not fixed by this UI release; do not apply npm audit fix --force to downgrade eslint-config-next.
