# Google setup and college acceptance testing

Release 0.2.1. Start with two real Google accounts: an administrator and a student. A third unapproved account is useful for denial tests. Use separate browser profiles so accounts and cookies do not mix. Keep OAuth client secrets and session secrets private.

## Upgrade your local copy

Stop `npm run dev` with Ctrl+C. Keep your existing `.env.local` and database. Extract the new source into a separate folder first, then copy the source files into your working folder, including `package.json` and `package-lock.json`. Do not replace `.env.local`, delete Docker volumes, or run `docker compose down -v`.

This release maps Docker PostgreSQL to `127.0.0.1:5433`. Set the local database URL to `postgresql://placement:placement_local_only@localhost:5433/placement` if using that mapping. The PostgreSQL port inside the container remains 5432.

Run one command at a time:

```powershell
npm ci
npm run check:config
docker compose up -d --wait
npm run db:migrate
npm run dev
```

No new SQL migration is needed for 0.2.1. Existing migration checks are safe to run. Do not seed again unless you want to refresh fictional demo data.

## Configure real Google sign-in

1. Open https://console.cloud.google.com/ and select or create a development project.
2. Open **Google Auth Platform**, then complete **Branding** with the application name, support email, and contact email.
3. Configure **Audience**. Use External for test accounts outside the college's Google Workspace organization. An organization-owned project may offer Internal for organization-only use. For an External app kept in Testing, add the administrator and student accounts as test users where requested by the console.
4. Under **Clients**, create an OAuth client with application type **Web application**. This is an OAuth client, not an API key or a service account.
5. Set these local values exactly:

| Console field | Value |
|---|---|
| Authorized JavaScript origin | `http://localhost:3000` |
| Authorized redirect URI | `http://localhost:3000/api/auth/callback/google` |

6. Copy the client ID and client secret into the existing `.env.local` entries. Set `TNP_ADMIN_EMAILS` to your real administrator account's email. Multiple administrator emails are comma separated. Do not add student emails to this administrator setting.

```dotenv
GOOGLE_CLIENT_ID=your_actual_oauth_client_id
GOOGLE_CLIENT_SECRET=your_actual_oauth_client_secret
TNP_ADMIN_EMAILS=your_actual_admin_email
LOCAL_DEMO_ENABLED=false
LOCAL_DEMO_PASSWORD=
```

These are placeholders to replace privately. Keep the existing `NEXTAUTH_SECRET`, database URL and `NEXTAUTH_URL`. Restart `npm run dev` after running `npm run check:config`. Use **Continue with Google** and select your administrator account.

The app requests only `openid email profile`. You do not need to enable Calendar or Meet APIs for this release's manual meeting URL workflow. Sign-in credentials do not configure Meet permissions, issue invitations, or import attendance automatically.

Import a small new CSV with real test student emails. Fictional `example.com` sample accounts cannot sign in through Google. If C23222 already belongs to student1@example.com, use a new CRN for the real student, such as TEST001. Existing CRN/email mappings cannot be overwritten by an import.

```csv
crn,name,email,department,batch
TEST001,Test Student,replace_with_real_student_email,Computer Engineering,2027
```

Replace the student email before importing. Never use a fabricated identity for the live college roster.

## Test both workspaces

Record Pass or Fail and attach the relevant error if any. These steps require your browser and real accounts, and are not replaced by automated API tests.

| Test | Action | Expected result |
|---|---|---|
| Administrator login | Sign in with an email in TNP_ADMIN_EMAILS | Administrator menus appear |
| Student login | Use the approved student account in another browser profile | Student menus appear; administrator resources are denied |
| Unapproved login | Sign in with the third account | Pending roster notice; no eligible events or meeting admission |
| Logout | Sign out, then reload | Login page; authenticated API calls denied |
| Roster preview | Upload the small test CSV | Preview appears before saving; no new student until confirmed |
| Roster import | Confirm the preview | Counts, roster and audit log update |
| Invalid roster | Try duplicate CRNs/emails or a changed CRN/email mapping | Clear validation error; no partial import |
| Search and pagination | Use the 500-row demo file, search by CRN/email, change pages | Matching rows, accurate count, no mixed identities |
| Event creation | Create a future draft with a real host-created Meet URL and one approved student | Draft appears for administrator; hidden from student |
| Input validation | Try reversed event times or a non-Meet URL | Submission rejected |
| Publishing | Review native Meet permissions, acknowledge, publish | Student sees assigned event |
| Joining window | Try outside the joining window | Admission denied; window opens 15 minutes before start and ends at event end |
| Authorized join | Join during the window using the selected student | Admission dialog shows own approved email and opens Meet separately |
| Access decision | Open event's access tab after a join attempt | Allowed or denied record appears; same-minute attempts are grouped |
| Unapproved/ineligible join | Use third account or deselect a student and republish | Portal admission denied |
| Suspend/restore | Suspend student, retry Join in the existing student session; restore and retry | Denied after suspension; allowed after restoration when otherwise eligible |
| Edit event | Change title, schedule, URL or eligibility | Event returns to draft; review Meet invitations and publish again |
| Close event | Close and retry Join | Portal admission denied; event cannot be edited or republished |
| Invitation export | Download eligible-account CSV | Active eligible students only; student account cannot export administrator data |
| Attendance preview | Download the event-specific template, edit as needed, upload | Eligible email and event-specific ISO timestamps validate before saving |
| Attendance import | Confirm, then repeat the same import | One record per student/event; no duplicate duration |
| Overlapping attendance | Import overlapping intervals | Overlap counted once |
| Invalid attendance | Try unknown email or times outside allowed event range | Rejected without partial writes |
| Student attendance | Check approved student and third account | Each sees only own records; Join alone creates no attendance |
| Attendance export | Download the event report | Correct CRNs, names, emails, timestamps and minutes |
| Activity and refresh | Make changes, open attendance/activity, click header Refresh | Current records load; errors remain visible if requests fail |
| Profile | Open student profile | Own CRN, email, department and status only |
| Small screen | Resize to phone width, open menu, tables and import dialogs | Navigation works; tables can scroll horizontally; dialogs scroll vertically |
| Keyboard | Tab through navigation, forms and dialogs | Visible focus, labeled fields and usable controls |
| Reduced motion | Enable reduced motion in OS/browser | Entrance and hover animations stop |

The attendance template uses the first eligible account and the event's full time range as an example. For a real report, replace those values with actual participant intervals before importing. A sample row is not evidence of attendance.

## Test Google Meet separately

Create a real Calendar/Meet event as the host. Invite only the approved test account. Configure native access restrictions using the controls available to that host's Workspace account. Test an invited student, an uninvited account with a copied URL, and a removed participant. Record the actual outcome.

The portal cannot enforce portal-only entry to an ordinary Google Meet URL. An already invited account may join directly. A portal suspension does not remove an invitation or eject an active participant. The host must manage native Meet permissions. Do not approve a college rollout based on hiding the URL or on a portal-only suspension test.

No video recordings, transcripts or chat archives are stored by this release. Attendance and access logs are different records.

## Automated checks

Stop your running development server first. Tests use isolated embedded PostgreSQL and do not use your Docker database or roster.

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:http
npm run test:load
npm run build
npm audit --omit=dev
```

`test:http` temporarily uses port 3107 and NextAuth demo sessions, with test-only OAuth configuration to check provider registration. It does not complete a real Google OAuth exchange. Use `npm run dev` after testing; local demo login is disabled by production-mode `npm start`.

The 500-request test measures local portal admission against embedded PostgreSQL. A hosted test with realistic read/write traffic, session authentication, duration, database limits and recovery behavior is still required before supporting 500 live students. Media capacity is a separate Google Meet subscription limit.

References: https://support.google.com/cloud/answer/15544987, https://support.google.com/cloud/answer/15549257, https://next-auth.js.org/providers/google.
