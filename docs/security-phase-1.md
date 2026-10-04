# Security phase 1 — release 0.2.2

This phase adds server-side session revocation. It does not certify production readiness.

## Implemented

- Each successful login creates a random 256-bit session identifier inside NextAuth's encrypted, HttpOnly JWT cookie. PostgreSQL stores only its SHA-256 hash and canonical authenticated email.
- Every server session resolution checks the registry, identity match, absolute two-hour expiry, revocation, and student suspension. Client update payloads cannot replace identity or privileges. Administrator access continues to derive from the server email allowlist.
- Logout revokes the registry record, so a copied cookie cannot be replayed afterward. If revocation fails, the auth endpoint returns 503 without clearing the browser cookie, allowing retry.
- Student suspension revokes all that student's sessions in the same transaction as suspension and its audit record. Restoration permits a fresh login; it does not revive previous sessions. Suspended students cannot create a usable new session.
- The loopback development demo provider limits password attempts to 20 per minute across all demo roles. This deliberately shared development bucket is not a production OAuth rate limiter.
- Authentication responses use Cache-Control: no-store. Health checks verify the session table exists, so missing migration 002 reports unavailable.
- CI runs a dedicated security regression suite. artifacts/security-report.json records the named checks and their pass/fail states; a failure exits nonzero.

## Upgrade locally

Stop the running Next.js development server before applying the patch. Preserve .env.local and PostgreSQL volumes. Apply against the committed 0.2.1 repository, then run:

```powershell
npm ci
docker compose up -d --wait
npm run db:migrate
npm run lint
npm run typecheck
npm test
npm run test:security
npm run test:http
npm run test:load
npm run build
npm run dev
```

Migration 002 creates a new table and indexes; it does not change student or attendance data. Existing 0.2.1 cookies have no registered identifier and will require a fresh login. Review artifacts/security-report.json and artifacts/http-report.json after testing.

For a production rollout, migrate first, then replace all old app instances together. An older 0.2.1 instance does not enforce revocation. Do not expose a mixed-version deployment during the security transition. Confirm health is 200, log in again, and check both roles before opening access. A rollback to 0.2.1 loses revocation enforcement even though the new table remains.

## Tests and limits

The security suite covers registry hashing, identity matching, expiration, revocation, suspension, client claim tampering, database failure, demo throttling, and administrator endpoint denial. The HTTP suite uses real NextAuth cookies and a PostgreSQL protocol connection, including copied-cookie replay, session update tampering, and failed logout recovery. Embedded PostgreSQL is used for test isolation; this is not a managed-production database test.

The 500-request test exercises the admission service with injected test actors. It does not measure the newly added session lookup, real Google login, deployed HTTP capacity, or Google Meet media. Run hosted end-to-end load tests before claiming 500, 2,000 or 5,000 concurrent users.

## Remaining release gates

1. Headers: replace inline-script CSP allowances with a tested nonce policy; verify production HTTPS cookie flags, HSTS and cache isolation in the deployed app.
2. Authentication: configure and test real college Google OAuth; enforce administrator MFA through the college identity provider; configure production authentication and read-request throttling at a trusted ingress. Do not derive identity or limiter keys from arbitrary forwarded headers.
3. Operations: validate the existing non-root Docker image, add readiness/monitoring and alerts, secret rotation, session-table retention, database backup and restore checks, and migration rollout automation. Expired sessions remain stored until a retention job is introduced.
4. Capacity and acceptance: test actual deployed authentication/database pooling under realistic load and complete administrator/student browser acceptance. Dependency security review, including development tooling advisories, remains required.

No protection can make browser-visible data invisible to an authorized user's developer tools. The server prevents identity changes from granting access. Once a Google Meet URL is delivered, the user can inspect or copy it. Native Meet access restrictions must protect direct entry; portal suspension does not remove someone already inside a meeting or revoke a Meet invitation. Fullscreen and tab restrictions are not an authorization boundary.
