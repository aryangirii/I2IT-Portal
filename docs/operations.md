# Operations and recovery

This release is for a controlled college pilot after configuration. Capacity and external meeting restrictions must be checked on the actual deployment.

## Routine operation

- Set a support email and responsible TNP owner outside the application until a configurable contact field is added.
- Protect administrator Google accounts with the college's two-step verification policy.
- Monitor deployment errors, `/api/health`, API latency and database connection usage.
- Use a managed database connection pooler. `DB_POOL_MAX` applies per process, not across the entire deployment.
- Export attendance after each event. Access records are admission decisions and are grouped by account/event/minute.
- Set a documented retention policy for student records, attendance, access decisions and audit history. This release does not automatically delete these records.

## Backups and restore

Enable the managed database provider's backups and point-in-time recovery where available. Take a backup before migrations. Practice restoring to a separate database, run migrations if needed, then check administrator login, roster counts, event eligibility and attendance before switching production connections. Avoid overwriting the only known-good database.

Migrations are checksummed. Add a new migration to change schema. There is no automatic down migration or destructive rollback command.

## Rate-limit housekeeping

Old rate-limit rows can be deleted as routine database maintenance. Windows are Unix minute numbers. Run this only against the intended database, using the college's approved schedule:

```sql
DELETE FROM rate_limits
WHERE window_id < floor(extract(epoch from now()) / 60) - 1440;
```

Attendance and audit records require a separate approved retention policy. Do not treat rate-limit cleanup as permission to remove college records.

## Revoking access

Suspension blocks the next portal admission. Event edits return the event to draft. Closing blocks new portal entry. Google Meet invitations and active participation must be changed in Google Meet separately. If an account is compromised, suspend it, remove it from the provider and recover the Google account.

Session cookies expire after two hours. Signing out clears the browser cookie. An already stolen session cookie is not centrally revoked by signing out on another device. Suspending the associated student prevents meeting admission. Removing an administrator from `TNP_ADMIN_EMAILS` takes effect when the runtime receives the updated configuration. Rotate `NEXTAUTH_SECRET` to invalidate all sessions during a serious authentication incident.

## Large events

The portal and video transport are separate systems. An AWS migration does not increase Google Meet limits. Prefer a moderated webinar/broadcast layout for thousands of attendees. Test media bandwidth, provider participant limits and cost independently from portal API load.
