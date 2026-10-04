# Release 0.2.3 — manual student entry and sign-in refresh

- Added administrator-only Add student alongside CSV import with shared identity validation and transactional auditing.
- Added student creation regression tests and real-session HTTP coverage.
- Redesigned sign-in into college/placement information and login sections, with accessible motion, responsive layout and historical company names sourced from college placement records.
- No new dependencies or database migration. Preserve .env.local.

See [release-0.2.3.md](release-0.2.3.md) for upgrade steps and browser acceptance checks.

# Release 0.2.2 — security phase 1

- Added server-checked, revocable sessions with absolute two-hour expiry.
- Logout invalidates copied cookies. Failed revocation returns 503 for retry.
- Student suspension revokes active sessions; restoration requires a new login.
- Added development demo login throttling, migration-aware health checks, and no-store auth responses.
- Added dedicated security tests and CI coverage, including HTTP cookie replay and session tampering.

Apply migration 002 before starting this version. Existing sessions require a fresh login. See [security-phase-1.md](security-phase-1.md) for rollout steps, test boundaries and remaining production gates.

# Release 0.2.1

- Added green accents, dark overview headers/workflow panels, page and card transitions, visible keyboard focus and reduced-motion support without adding animation dependencies.
- Refresh reloads the current attendance, activity, roster or event view as well as dashboard data.
- Student attendance instructions now describe personal participation records.
- Known OAuth errors display useful sign-in guidance without echoing arbitrary URL query strings.
- Attendance templates use the selected event's dates and first eligible account. Replace example intervals with real report data.
- Reopening import dialogs clears stale previews.
- Local Docker host port is 5433 to avoid the existing PostgreSQL conflict.
- Expanded automated security, admission, attendance and session checks. Added Google setup and college acceptance checklist.

No database schema changes. Preserve .env.local and Docker volumes during upgrade. Real Google login, native Meet restrictions, browser interaction and hosted-load acceptance remain pending.
