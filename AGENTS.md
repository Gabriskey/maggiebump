# MaggieBump repository guidance

## PROJECT PURPOSE

MaggieBump is a private/shared pregnancy planning web app for Gabriel and Maggie.
It tracks pregnancy progress, funds, expenses, appointments, medical/personal
notes, preparation checklists, and important dates. This intended private use
does not establish that the deployed database access rules are secure.

## CURRENT STACK

- Static HTML, CSS, and vanilla JavaScript with browser ES modules.
- Firebase JavaScript SDK 12.2.1 loaded directly from Google's CDN.
- Firebase Realtime Database and Firebase Hosting.
- localStorage for local persistence, pending offline changes, and a limited
  browser-local backup. This is not a complete offline or backup solution.
- No framework, package.json, build system, CI, or automated test suite.
- Direct DOM rendering, inline HTML event handlers exposed through `window`,
  and a custom canvas expense chart.

## IMPORTANT FILES

- `index.html`: application pages, navigation, and modal forms; loads CSS and
  JavaScript directly. Archive/file uploads are a coming-soon placeholder.
- `css/styles.css`: theme, responsive layouts, and component styles.
- `js/app.js`: application state, calculations, rendering, event handlers,
  local persistence, and Firebase sync.
- `firebase.json`: Hosting serves the repository root (`"public": "."`);
  Markdown documentation is excluded from deployment.
- `.firebaserc`: Firebase project and Hosting target mapping.
- `.gitignore`: ignores local caches, logs, dependencies, and `.env`.
- `404.html`: Firebase-style page-not-found document.

## FIREBASE

- Project: `maggiebump-454ea`.
- Hosting target/site: `maggiebump`.
- Production URL: https://maggiebump.web.app
- Realtime Database: `https://maggiebump-454ea-default-rtdb.asia-southeast1.firebasedatabase.app`.
- Shared Realtime Database path: `maggieBump/main`.
- Preserve the existing Firebase project and target configuration. Do not create
  another Firebase project or casually change `.firebaserc`.
- Default deploy command on Windows: `firebase.cmd deploy --only hosting`.
  This documents the command; it is not authorization to deploy.
- Keep documentation and any future backup artifacts out of Hosting's public
  files. Git ignore rules do not define Hosting exclusions.

## DATA SAFETY - VERY IMPORTANT

Existing user data must never be casually reset, replaced, regenerated, or
migrated. Preserve existing behavior and data during every edit.

Protect all shared sections: `settings`, `fundDeposits`, `expenses`,
`appointments`, `notes`, `checklist`, and `importantDates`. Also protect custom
checklist items, checklist checked states, record IDs, pending sync state,
pending deletion state, and existing localStorage keys.

Current localStorage keys:

| Key | Purpose |
| --- | --- |
| `bumptrack-data-v1` | Main local dataset |
| `bumptrack-data-v1-backup` | Previous local snapshot, not a durable backup history |
| `maggiebump-pending-sync-v1` | Pending section versions |
| `maggiebump-pending-deletes-v1` | Pending deleted record IDs |
| `maggiebump-active-page` | Navigation preference |
| `maggiebump-checklist-sort` | Checklist sorting preference |
| `maggiebump-sidebar-expanded` | Sidebar preference |

Startup loads and normalizes local data, then subscribes to the shared cloud
path. Cloud sections replace local sections when no local changes are pending.
Pending record sections merge by ID with local records winning and pending
deletions applied. Missing cloud sections are queued for upload from local data;
an empty cloud dataset queues every section. Writes replace the requested
section using `update()` at the shared path. Successful writes clear pending
state only if the pending section version has not changed.

## SYNC RULES

- Inspect save/load/sync behavior before changing persistence code.
- Do not call save routines from render functions unless absolutely necessary.
- Preserve section-specific Firebase syncing. Do not replace the entire shared
  Firebase data object unnecessarily.
- Preserve pending-delete behavior and record identity.
- Be especially careful with missing versus intentionally empty cloud sections;
  missing sections can cause stale local data to be uploaded again.
- Do not test destructive sync changes against production casually. Isolate
  sync testing and preserve backups before intentional data-changing tests.
- Local/browser previews connect to the real Firebase database unless explicitly
  isolated. Opening the app can trigger writes without a user editing a record.

## UI / CODE RULES

- Home's ultrasound history uses `ULTRASOUND_RECORDS` as fixed/reference data,
  separate from saved state and Firebase sync. Report EDCs must not override the
  app's working due date (`PREGNANCY.dueDate`, January 15, 2027).
- Preserve the current MaggieBump design language.
- Prefer small targeted edits and reuse existing components, modals, and patterns.
- Avoid unrelated refactors.
- `css/styles.css` contains later override blocks, so cascade order matters.
- `js/app.js` is large and tightly coupled; inspect relevant functions before
  editing. HTML IDs, inline handlers, and `window` exports are coupled.
- Do not migrate to a framework unless explicitly requested.

## GIT / CODEX WORKFLOW

Codex must:

1. Read `AGENTS.md` first.
2. Inspect before editing.
3. Make the smallest safe change.
4. Preserve existing behavior and data.
5. Run appropriate validation.
6. Run `git diff --check`.
7. Run `git status --short`.
8. Report exact files changed.

Unless explicitly requested, Codex must not deploy, stage, commit, push, force
push, or change remotes.

ChatGPT/user handles review, Firebase deployment, live testing, git status,
exact staging, commit, push, and final clean-tree verification. Codex's required
status check above is part of its validation report, not a claim that these
later workflow steps are complete.

TPCTC means:

- TEST PASSED
- COMMITTED
- TREE CLEAN

Do not report TPCTC unless all three conditions have been verified.

## SECURITY / KNOWN RISKS

These are existing findings, not instructions to change behavior incidentally:

- Local development currently connects to production Realtime Database.
- Firebase Authentication and App Check are not implemented in the client.
- Database rules have not yet been audited and are not tracked here.
- Section-level sync can have concurrency/conflict risks; there are no database
  transactions or durable shared deletion markers in the current client.
- Backups are browser-local and limited to one previous snapshot. Clearing site
  data loses local copies and pending state; corrupt local JSON falls back to defaults.
- Sync failures are mostly console-only, with no visible sync status or explicit
  database listener error callback.
- Hardcoded pregnancy information exists in HTML and JavaScript and must not be
  altered casually. Normalization forces the configured name, due date, and LMP.
- Some rendered dynamic values may need future escaping review.

## FUTURE / DEFERRED WORK

- Firebase rules/security audit.
- Safer development/test environment.
- Sync robustness review.
- Backup/export strategy.
- README if useful later.
