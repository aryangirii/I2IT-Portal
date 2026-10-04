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
