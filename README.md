# I²IT Placement Desk

A placement-event portal with separate student and TNP administrator workspaces. This standalone version runs with standard Next.js and PostgreSQL, locally or on Vercel. It does not depend on ChatGPT hosting or Cloudflare D1.

Release 0.2.1 adds dark overview headers, green accents, reduced-motion-aware transitions, current-section refresh, clearer authentication errors, and event-specific attendance templates. See [Google setup and acceptance testing](docs/google-and-acceptance-testing.md) for upgrade steps and the full two-workspace checklist.

The local Docker database now uses host port **5433** to avoid a common conflict with an existing PostgreSQL installation. Keep your `.env.local` database URL consistent with `docker-compose.yml`.

## What works

- Google sign-in with verified email, encrypted session cookies and server-controlled administrator access.
- Official CRN/email roster, CSV preview, conflict detection, bulk imports and student suspension.
- Draft, published and closed events; student selection by department/search; event and eligibility editing.
- Every admission checks the authenticated identity, roster status, eligibility, event status and joining window.
- Student overview, assigned events, profile and private attendance history.
- Administrator roster search/pagination, event details, access decisions, audit history, invitation exports and attendance exports.
- Attendance CSV validation, overlapping-session merging and repeatable imports.
- PostgreSQL transactions, bound SQL parameters, database-backed write rate limits, security headers and health endpoint.

## Meeting behaviour

This release uses Google Meet. TNP supplies a real meeting URL, invites approved accounts through Google Calendar, sets Restricted access and disables uninvited join requests where the Workspace edition supports it. Publishing requires TNP to acknowledge this setup. Students enter through a button and then open Meet separately using their approved Google account.

The portal does not create Google meetings, apply or verify native restrictions, synchronize invitations, automatically retrieve attendance, embed the Meet call, or store video recordings. Editing an event returns it to draft so the host can review invitations again. Suspending a student or closing an event blocks new portal admission but does not remove existing Meet invitations or end an active call. The host must apply those changes in Meet too.

An approved browser can inspect a destination that it receives. URL hiding and fullscreen are not access controls. Provider restrictions protect leaked Meet links. An already invited student may enter directly through Google Meet. If strict portal-only embedded calls are required, implement a supported embedded meeting provider through `lib/meetings` before college rollout.

## Local setup on Windows

Install Node.js 22.13 or later and Docker Desktop with Linux containers enabled. Extract this folder, open PowerShell here, and run:

```powershell
npm ci
Copy-Item .env.example .env.local
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
docker compose up -d --wait
```

Paste the generated secret into `NEXTAUTH_SECRET` in `.env.local`. Choose one authentication setup below, then run:

```powershell
npm run check:config
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Wait for the PostgreSQL container to become healthy before migrating. The default Docker credentials are for local development only. Keep `.env.local` private.

### Option A: real Google login

Create a Google Cloud OAuth client of type Web application. Configure the consent screen and add test users if the app is in testing mode. Use:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `TNP_ADMIN_EMAILS` in `.env.local`. Administrator emails are a comma-separated list of the TNP accounts. Sign in as an administrator, import the roster and then test with a student's actual approved Google account. Student email addresses may be personal Gmail accounts if those are the college's approved identities.

Enable two-step verification for administrator Google accounts through the college's identity policy. This application does not independently enforce a second factor.

### Option B: local demonstration without Google credentials

Set these fields in `.env.local`:

```dotenv
LOCAL_DEMO_ENABLED=true
LOCAL_DEMO_PASSWORD=choose-a-local-password-at-least-16-characters
```

Then run:

```powershell
npm run check:config
npm run db:migrate
npm run db:seed:demo
npm run dev
```

The login page lets you choose TNP administrator, approved student or unregistered student. All require your local demonstration password. Demonstration identities are fixed fictional accounts, not user-supplied emails. They work only with a loopback application URL during development, and are disabled on Vercel and in production.

The seeded meeting uses a placeholder URL. It demonstrates admission, not a real video call. Edit the event with a real host-created Meet URL and publish again after configuring the meeting permissions.

## CSV files

Sample files are available in `public/samples` and from the administrator's import dialog:

| File | Purpose |
|---|---|
| `students-20.csv` | Small import trial |
| `students-500.csv` | Functional and concurrency trial roster |
| `students-5000.csv` | Maximum-size roster import |
| `attendance-template.csv` | Attendance column and timestamp format |

Roster columns: `crn,name,email,department,batch`. All sample emails use the reserved `example.com` domain. They do not create real Google accounts. Replace sample emails with real approved test accounts to verify Google login.

Attendance columns: `email,joined_at,left_at`. Use ISO timestamps with a timezone, within the selected event's time window. The sample's timestamps must be adjusted for your event. Multiple rows for the same student represent sessions, and overlapping intervals count once. A new confirmed import replaces the attendance entry for each included student in that event. Omitted students retain their previous records. An Enter meeting click is not attendance.

Files may contain up to 5,000 data rows and 1 MB. Duplicate CRNs/emails and changes to an existing email-to-CRN mapping are rejected. Identity corrections need a reviewed administrative data change; the product does not provide self-service identity reassignment.

## Vercel deployment

1. Push this folder's contents to your own Git repository. Keep `.env.local`, database data and build output out of Git.
2. Create a managed PostgreSQL database. Use the provider's pooled connection URL for application traffic and direct URL for migrations.
3. Import the repository into Vercel with the Next.js framework preset. The repository includes `vercel.json`, the npm lockfile and standard build commands.
4. Set environment variables from the table below. Google credentials and the session secret stay server-side. Do not prefix them with `NEXT_PUBLIC_`.
5. Add `https://YOUR_DOMAIN/api/auth/callback/google` to the Google OAuth client's redirect URIs. Use the actual application domain for `NEXTAUTH_URL`.
6. Run migrations against the intended database before release. Use a dedicated migration account if possible, and give the runtime account only the permissions it needs.
7. Deploy, verify Google login with actual administrator/student accounts, validate the host's Meet restrictions and run a hosted load test before inviting a full batch.

| Variable | Setting |
|---|---|
| `NEXTAUTH_URL` | Full HTTPS application origin |
| `NEXTAUTH_SECRET` | Random secret with at least 32 characters; use a new production value |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `TNP_ADMIN_EMAILS` | Approved TNP administrator emails, separated by commas |
| `DATABASE_URL` | Pooled PostgreSQL connection URL with `sslmode=verify-full` |
| `DATABASE_DIRECT_URL` | Optional direct connection URL for migrations; use TLS remotely |
| `DB_POOL_MAX` | Defaults to 5 connections per application instance |
| `LOCAL_DEMO_ENABLED` | `false` for every deployed environment |
| `LOCAL_DEMO_PASSWORD` | Leave unset for deployment |

Production refuses missing Google credentials, HTTP application URLs, a database URL without `sslmode=verify-full`, or enabled demonstration mode. Supply a trusted CA certificate if your database uses a private certificate authority. Do not disable certificate verification to solve connection errors.

For migrations, use a local private `.env.local` containing the intended remote URLs, then run `npm run db:migrate`. The migration runner uses a lock, checksums and transactions. Already applied migrations are skipped. Do not edit an applied migration; add a new SQL file.

A local optimized build can be checked with `npm run build`. `npm start` runs in production mode and therefore requires the production authentication/TLS configuration. Use `npm run dev` for local demo mode.

## Code organization

| Folder/file | Responsibility |
|---|---|
| `app` | Next.js pages, error states and thin API handlers |
| `components/portal` | Student and administrator interface modules |
| `components/ui` | Shared interface primitives |
| `lib/auth` | Google identity, sessions and server role resolution |
| `lib/config.ts` | Runtime configuration validation |
| `lib/http/portal.ts` | Authentication boundary, method/origin/body checks and dispatch |
| `lib/services` | Roster, event, eligibility, attendance and dashboard logic |
| `lib/db` | Parameterized SQL interface, PostgreSQL pool and transactions |
| `lib/meetings` | Meeting-provider admission adapter |
| `db/migrations` | Versioned PostgreSQL schema |
| `scripts` | Migration, configuration, samples and local seeding |
| `tests` | Integration, real-session HTTP and concurrency tests |

Client code cannot grant administrator rights. Request headers from the old hosting system are not trusted. Other students' records and meeting URLs are not included in student dashboard responses. A valid eligible admission receives its own destination.

## Validation

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:http
npm run test:load
npm run build
```

Integration tests use actual embedded PostgreSQL through PGlite. HTTP tests start Next.js, authenticate through the development-only provider, use real NextAuth cookies, and connect through node-postgres to a local PostgreSQL wire test server. That permissive wire server is test-only and must never be deployed or exposed. Stop any running development server before running `test:http`. Google OAuth exchange still needs real configured accounts to test end to end.

The load test starts 500 admission requests together using 500 distinct approved identities. It is not a Vercel/network/managed-database capacity test, does not include OAuth exchanges, and does not measure video meeting capacity. See `docs/verification.md` for the recorded results and limitations.

## Operating as a college product

Before student rollout, assign a TNP owner, decide data retention, establish a support contact, configure database backups and verify a restore. Keep administrator Google accounts protected and review access/audit records. Monitor `/api/health` and deployment logs. Runtime errors do not log meeting URLs, session cookies or roster payloads.

Database-backed rate limits are shared across application instances. Keep the connection pool small and use an upstream pooler on Vercel. Indexes support email lookup, eligibility checks and event/student attendance. Imports use bulk SQL instead of one remote round trip per student. For 2,000–5,000 portal users, benchmark the actual deployment and database plan before claiming support. One large video event also needs a provider subscription or broadcast architecture suited to that audience.

For an AWS migration, the application supports a standalone Node build. Use a container service, managed PostgreSQL, secure secrets and an appropriate database proxy/pooler. Media remains with the meeting provider. Do not move the database to ephemeral server disks. See `docs/operations.md` for recovery and maintenance steps.

## Security hardening

Release 0.2.2 adds revocable server-checked sessions. Apply migration 002 before starting the app. See [the phase 1 rollout and remaining production gates](docs/security-phase-1.md). Run `npm run test:security`; inspect `artifacts/security-report.json` for named regression results.
