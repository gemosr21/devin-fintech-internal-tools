# Build log

Actual commands, results, failures, and scope cuts. Times are minutes since the 120-minute timer started.

| Min | Step | Command / action | Result |
|---|---|---|---|
| 0 | Clone + write access | `git clone …`; create branch and `git push -u origin HEAD` | OK — clone and push both worked |
| ~2 | Scaffold | `npx create-next-app@latest` (TS, App Router, no Tailwind/ESLint) into a temp dir, then copied into the repo | Next.js 16.4.0, React 19.3 |
| ~3 | Deps | `npm install better-sqlite3 zod` / `npm install -D vitest @types/better-sqlite3` | **Failed:** ERESOLVE, because vitest 5 wants `@types/node` ^22 or >=24 and the scaffold pins ^20. Fixed by adding `@types/node@^24` (matches Node 24). |
| ~5 | Native module | `node -e "require('better-sqlite3')…"` | OK, SQLite 3.53.4 on Node 24.19.0 |
| ~6 | Next config | Removed scaffold defaults `cacheComponents`/`partialPrefetching` (they change dynamic-rendering semantics); set `serverExternalPackages: ["better-sqlite3"]` | — |
| ~7 | Build check | `npm run build` + `next start`, then `curl /` on a page that queries SQLite | OK |
| ~8 | **Checkpoint A** | — | Passed. No fallback needed. |
| ~10 | Domain layer | `lib/{schema,db,seed,identity,audit,refunds}.ts` | — |
| ~12 | Domain tests | `npm test` | 12/12 pass on first run |
| ~13 | Tooling | `npm test` warned that `vitest.config.ts` is ESM loaded as CJS | Renamed to `vitest.config.mts` |
| ~13 | **Checkpoint B** | `npm test`, `npm run typecheck` | Passed |
| ~15 | API + UI | route handlers, identity switcher, list/detail/decision pages | — |
| ~16 | Route tests | `npm test` (vitest `@` alias added so route modules import) | 17/17 pass; `npm run build` OK |
| ~17 | Critical path over HTTP | `npm run seed && npx next start`, then `scripts/verify-api.sh` | 10/10 PASS (401 ×2, 403 ×2, 400 ×2, 200, 409, detail, exactly 1 audit event) |
| ~18 | Persistence across restart | Stopped `next start`, started it again without reseeding, `curl /api/refunds/RF-1002` | Still `approved` by riley, with its single audit event |

## Browser check of the refunds flow (as Riley Reviewer)

- `/refunds` lists 24 seeded requests; status filter and search work.
- `/refunds/RF-1023`: clicked **Approve** with an empty reason → UI showed `400: A reason is required` (server validation, nothing written).
- Typed a reason, clicked Approve → status `approved`, decided by `riley`, audit history shows one `refund.approved` row with before/after JSON.

## Feature-flag gate decision

The refunds browser flow worked and all 17 tests passed at about 22:44 UTC on the VM clock. The user's repo initial commit is 22:23 UTC, so this was well under the minute-65 threshold by the VM clock. The user's own timer is authoritative and I could not see it. Decision: **implement feature flags**, kept small.

Added `feature_flags` table, `seedFlags`, `lib/flags.ts` (`listFlags`, `setFlag` reusing `requirePermission` + `recordAudit` in one transaction), `GET /api/flags`, `POST /api/flags/:key`, `/flags` page, `tests/flags.test.ts`.

```
npm test        -> Test Files 3 passed, Tests 20 passed
npm run typecheck -> clean
npm run build   -> ok (routes /flags, /api/flags, /api/flags/[key])
```

## Re-verify against a restarted server (after flags)

Failure: my first attempt used `pkill -f "next start"`, which also matched and killed my own shell command. Switched to `fuser -k 3000/tcp`.

```
npm run seed && npx next start -p 3000
scripts/verify-api.sh   -> all 10 checks PASS (401,401,403,403,400,400,200,409, detail+1 audit)
POST /api/flags/fx_quote_v2 {"enabled":true}
  vera  -> 403   riley -> 403   ada -> 200   ada again -> 409
  no identity -> 401   {"enabled":"yes"} as ada -> 400
```
Browser `/flags` as Riley: read-only notice, no toggle buttons; `fx_quote_v2` shows `ada` + 1 audit event.
