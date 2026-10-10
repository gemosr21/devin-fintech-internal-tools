# Devin fintech internal tools — refunds review prototype

A prototype built to test one question: **could a ~60-engineer Series C fintech use Devin to build and maintain internal tools instead of the stated $250K/year Microsoft Power Apps spend?**

This repo implements **one complete workflow** (refunds review) and a **small second tool** (feature-flag admin) on the same foundation, to check whether the custom-code approach holds up for this kind of app. It is **not production software** and does not replace every Power Apps capability.

> **DEMO IDENTITY — NOT AUTHENTICATION.** The "Acting as" switcher sets an unsigned cookie that anyone can change. It exists only so the server-side permission checks can be exercised. There is no login, SSO, or session security.

All data is synthetic (`example.test` emails, made-up merchants). No real payments or KYC.

## Run it

Requires Node 24 (`.nvmrc`) and npm 10.

```bash
npm install
npm run seed          # (re)creates data/app.db with 24 refund requests + 4 flags
npm run dev           # http://localhost:3000  (or: npm run build && npm start)
```

Pick an identity in the yellow banner. `DATABASE_PATH` overrides the DB location (default `./data/app.db`).

## Demo identities and permissions

| User | Role | Refunds | Feature flags |
|---|---|---|---|
| Vera Viewer (`vera`) | viewer | read | read |
| Riley Reviewer (`riley`), Rana Reviewer (`rana`) | reviewer | read + approve/reject | read |
| Ada Admin (`ada`) | admin | read (**no decisions**: separation of duties) | read + toggle |
| none / unknown id | — | 401 on every read and write | 401 |

Permissions are checked on the server in `lib/identity.ts` (`requirePermission`), not just hidden in the UI. Direct API calls get the same 401/403.

## What the refunds tool does

- List with status filter and search (id, customer, email, merchant).
- Detail page with request data, decision, and audit history.
- Reviewer approves or rejects a **pending** request with a **required reason** (1–500 chars).
- The decision and its audit event are written in **one SQLite transaction**. If the audit insert fails, the decision rolls back.
- The update only applies `WHERE status = 'pending'`, so a second decision (or a double-click race) gets **409** and the first decision stands.

## Feature flags (second tool)

`/flags`: list flags; admins can turn each on or off. It reuses the same identity/permission module (`flags:write` = admin only) and the same `recordAudit` call inside the same kind of transaction. Toggling to the current state returns 409. Same caveats as below: it's a demo, and nothing reads these flags.

This **does** show cross-tool reuse of permissions and audit, but only across two small tools built by the same agent in one session. It doesn't show reuse across teams or over time.

## Audit semantics

`audit_events` is **application-level append-only**: the app only inserts, and SQLite triggers reject `UPDATE`/`DELETE` on that table. It is **not tamper-proof**. Anyone with file or DB access can drop the triggers or edit the file. Real tamper evidence would need e.g. shipping events to a write-once store or hash-chaining, which is out of scope.

Seeded "already decided" requests have no audit events. Only decisions made through the app are audited.

## Architecture

Single Next.js 16 (App Router) + TypeScript app, no separate backend.

```
app/                      UI (server components) + API route handlers
  api/refunds/...         GET list/detail, POST /:id/decision
  api/flags/...           GET list, POST /:key
  api/demo-identity       sets the demo cookie (not auth)
lib/
  db.ts schema.ts seed.ts better-sqlite3 connection, schema+triggers, synthetic seed
  identity.ts             roles -> permissions, requirePermission
  audit.ts                recordAudit / listAuditEvents
  refunds.ts flags.ts     domain logic: validation (zod), transaction, audit
tests/                    vitest: domain + route-handler tests on temp DBs
scripts/verify-api.sh     raw HTTP critical-path check against a running server
```

All writes go through API route handlers, so the forbidden-request cases can be tested directly with curl. Money is stored as integer cents. `better-sqlite3` is in `serverExternalPackages` because it's a native module.

## Tests and verification

```bash
npm test              # 20 vitest tests (domain + route handlers), temp DB per test
npm run typecheck
npm run build
# critical path against a real server:
npm run seed && npm run build && npx next start -p 3000 &
scripts/verify-api.sh
```

| Acceptance criterion | Covered by |
|---|---|
| Authorized decision persists | `tests/refunds.test.ts`, `tests/routes.test.ts`, `verify-api.sh` |
| Forbidden decision via direct request (none/unknown → 401, viewer/admin → 403), no write, no audit | route tests, `verify-api.sh` |
| Invalid input (blank/too-long reason, bad decision) → 400 | domain + route tests, `verify-api.sh` |
| Duplicate decision → 409, first decision kept | domain + route tests, `verify-api.sh` |
| Exactly one audit event per decision | domain tests, `verify-api.sh` |
| Audit failure rolls back the decision | `tests/refunds.test.ts`, `tests/flags.test.ts` |
| Audit UPDATE/DELETE rejected by trigger | `tests/refunds.test.ts` |
| Persistence across DB reopen / server restart | domain test; manual restart check (BUILD_LOG.md) |
| Flags: admin-only writes, audit, rollback | `tests/flags.test.ts`, curl checks (BUILD_LOG.md) |
| Fresh clone sets up and passes | BUILD_LOG.md |

`BUILD_LOG.md` has the commands that were actually run, their results, failures, and scope decisions.

## Production gaps (not done)

- **Authentication/SSO.** Replace the demo cookie with real identity (e.g. Entra ID / OIDC), with roles from the IdP's groups.
- **Database.** SQLite file on local disk. Production needs a managed DB (e.g. Postgres), migrations, backups, and multiple instances.
- **Audit integrity.** Not tamper-proof (see above). No retention policy, export, or SIEM feed.
- **Hosting/ops.** No deployment, monitoring, alerting, rate limiting, CSRF hardening beyond same-origin JSON, or secrets management.
- **Real integrations.** No payment processor, ledger, KYC, or notifications. Approving a refund moves no money.
- **Workflow depth.** No maker-checker thresholds, assignment/queues, SLAs, pagination, or bulk actions.
- **Accessibility/UX review, security review, load testing.** None done.
- **Ownership.** Someone has to own, patch, and upgrade this code (Node/Next/deps) for as long as it runs.

## Power Apps vs. custom app with Devin

The exercise states the Power Apps spend as **$250K/year**. How much of it is avoidable is **unknown**, and so is the contract scope. That depends on which licenses, users, environments, Dataverse capacity, connectors, and services the contract includes, and which other apps (beyond the internal tools in question) rely on it. This prototype says nothing about that number by itself.

What Power Apps provides that this prototype does **not** (from the planning research, which is not in this repo):
- Built-in identity and access through Entra ID, plus admin-managed environments.
- Dataverse with role-based security, auditing, and managed storage.
- A large library of managed connectors.
- Tenant-level governance such as data loss prevention policies.
- Microsoft-hosted, patched runtime and ALM via solutions/pipelines.
- A path for non-engineers to build and change apps.

What the custom approach showed here:
- One complete workflow, built in a single session with Devin.
  - Server-enforced permissions, transactional audit, and tests.
- A second small tool reusing the same permission and audit modules.
- Everything is ordinary code: reviewable in PRs, testable in CI, and portable.

What this does **not** show:
- Long-term maintenance cost or quality over many tools and many months.
- Production auth, hosting, or compliance work, each of which adds real cost.
- Whether non-engineer builders would be served.
- Total cost, which would also include engineer review time, hosting, and Devin usage.

A fair next step would be to get the contract line items, list which current Power Apps apps and users would move, and price the production gaps above against the avoidable portion.
