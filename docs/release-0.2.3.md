# Release 0.2.3 — student entry and sign-in page

## What changed

Student roster now offers Add student and Import CSV. The manual form captures name, CRN, existing Google email, department and graduation year/batch. Server-side validation normalizes CRN/email and rejects malformed or unexpected fields. Only TNP administrators can add students. Duplicate CRNs or emails return 409 without overwriting a record. Insert and audit are transactional, and writes retain origin checks and request throttling.

Manual entry does not create a Gmail account, a password, or event eligibility. The student must verify their email through Google login, and TNP must separately select that CRN for a published event. Identity correction is not part of this form; an existing CRN cannot be reassigned to a new email.

The unauthenticated page now has a dark green college/placement section and a white login section. It includes the existing college logo, a simple Prepare/Connect/Progress visual, original encouragement copy, clear Google sign-in, and a separate expandable development-account section. Mobile layout stacks the sections and offers a direct sign-in anchor. Focus styles, native form labels, accessible dialog semantics, loading states and reduced-motion rules are included. No cursor-following effects, external fonts or new packages were added.

Company names are historical placement examples from https://www.isquareit.edu.in/student-selected/, reviewed 2026-10-04: Infosys, IBM, Persistent Systems and LTIMindtree. The page links to the source and does not present these companies as currently hiring through the portal. Encouragement copy is original and has no invented attribution. Content lives in lib/content/college.ts for college review.

## Apply on Windows

Stop the Next.js server with Ctrl+C before applying the patch. The patch is based on the pushed 0.2.2 tree (36ca556). No new database migration or dependencies are needed. Preserve .env.local and database volumes.

```powershell
cd D:\Projects\placement-desk
git apply --check "$env:USERPROFILE\Downloads\I2IT-Portal-0.2.3.patch"
# Continue only if the check succeeds.
git apply "$env:USERPROFILE\Downloads\I2IT-Portal-0.2.3.patch"
```

Run lint, typecheck, test, test:students, test:security, test:http, test:load and build. New regression output is artifacts/students-report.json. CI runs the dedicated student suite. Migration 002 from 0.2.2 must already exist. If dependencies need repair, stop all project servers before npm ci.

## Your real student test

1. Keep your Google student session in your normal browser. In an Incognito window, use the loopback development administrator.
2. Open Student roster → Add student. Enter the actual student CRN, real Google email and academic details. Do not reuse a CRN already attached to a demo email.
3. Confirm the new row appears in the roster. Add it to an event's eligibility list, and publish the event with a current meeting window.
4. Refresh the Google student session. Check the correct CRN/email and assigned event, then use Enter meeting → Open Google Meet.
5. Verify duplicates show a useful error, cancel/reopen clears old form input, keyboard focus stays inside the dialog, and mobile pages fit without horizontal scrolling.

## Verification limits

Automated coverage uses embedded PostgreSQL and real NextAuth HTTP cookies with local demo identities. It verifies manual creation, validation, duplicate identity prevention, concurrent duplicate handling, audit rollback, CSV interoperability, suspension, event eligibility and rate limiting. Existing session and attendance suites are retained.

The cloud browser could not reach the local QA server, so visual layout, mobile rendering, keyboard interactions and click-through form acceptance still need the local browser checklist above. The actual Google OAuth exchange was previously confirmed by the user but was not repeated in this automated run. The service load test does not prove deployed capacity.

This release does not implement security phase 2. Stricter CSP, administrator MFA, production ingress throttling, container verification, monitoring and backup/restore validation remain release gates.
