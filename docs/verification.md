# Verification record

Validated the standalone application on Node.js 24.19.0 with Next.js 16.3.8.

| Check | Result |
|---|---|
| Functional/security integration checks | 36 passed against embedded PostgreSQL |
| HTTP checks with real sessions | 9 passed through Next.js and node-postgres |
| TypeScript and Next.js route type generation | Passed |
| ESLint | Passed |
| Optimized production build | Passed |
| Production dependency audit | 0 known vulnerabilities reported |
| Concurrent admission test | 500 requests started together; 0 failed |

Concurrency result: total 959 ms, p50 837 ms, p95 930 ms, p99 935 ms. These are local admission-test timings against a single embedded database. They exclude hosted infrastructure, Google OAuth exchanges, browser rendering and media. They do not establish Vercel or AWS production capacity.

The HTTP suite verifies the login page, college logo, security headers, anonymous rejection, forged hosting-header rejection, real session roles, roster import, event publishing, admission denial, attendance isolation, database health and sign-out. Integration checks also cover editing, bulk imports of 5,000 identities, transaction validation rollback and rate limiting.

Browser visual and interaction verification could not run: the test-browser download failed certificate validation, and its automation daemon could not initialize. No browser screenshots or visual-pass claim are included. The existing college branding and responsive green/white/black interface are retained. Browser testing with the college's actual accounts remains required before rollout.

Real Google OAuth login, Google Meet host controls, native participant capacity and database TLS against a hosted provider require the college's configuration. They have not been exercised with real college credentials. Docker Desktop and Vercel deployment were not available in this session.

The audit result is a point-in-time dependency check, not a guarantee against all vulnerabilities. The inherited Next.js version was upgraded after its audit reported a critical advisory. The lockfile records the patched dependency tree.
