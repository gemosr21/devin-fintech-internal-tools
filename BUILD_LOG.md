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

The refunds browser flow worked and all 17 tests passed at about 22:44 UTC on the VM clock. The user's repo initial commit is 22:23 UTC, so this was well under the minute-65 threshold by the VM clock. The user's own timer is authoritative and I could not see it. The user later confirmed it read about 20 minutes, well under 65. Decision: **implement feature flags**, kept small.

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
Browser `/flags` as Ada Admin: toggle buttons shown; clicked **Turn on** for `instant_refunds` → state `on`, last changed `ada`, 1 audit event.

## Fresh-clone setup check

```
git clone -b devin/1791672047-refunds-prototype https://github.com/gemosr21/devin-fintech-internal-tools ~/fresh
cd ~/fresh            # no data/ dir in the clone (gitignored)
npm install           -> found 0 vulnerabilities
npm test              -> Test Files 3 passed, Tests 20 passed
npm run typecheck     -> clean
npm run build         -> Compiled successfully
npm run seed          -> Seeded 24 synthetic refund requests into ~/fresh/data/app.db
npx next start -p 3001
scripts/verify-api.sh http://localhost:3001   -> all 10 checks PASS
```
Restart persistence (fresh clone): stopped and restarted the server, then `GET /api/refunds/RF-1002` returned `approved riley verify-api.sh`, audit events: 1.
Failure: my first post-restart query checked RF-1023 by mistake, which was still pending in the fresh DB, so it proved nothing. Re-ran it against RF-1002, the request verify-api.sh had approved.

## Scope cuts / not done

- Feature flags were **not cut**. Cross-tool reuse of `requirePermission` + `recordAudit` was demonstrated, but only across two small tools in one session.
- No production auth, deployment, real integrations, pagination, or maker-checker thresholds (see README → Production gaps).
- No automated browser (E2E) tests. Browser checks were manual and are described above.

## Devin Review fixes (PR #1)

- `listRefunds` search now includes `customer_email`. The README already claimed this, so the code didn't match it until now. Test added.
- `/api/demo-identity` `returnTo`: `//evil.example` and `/\evil.example` were open redirects. Now only same-origin paths are allowed. Route test added.
- `DecisionForm` / `FlagToggle`: a rejected `fetch` left the buttons disabled. Now uses `try/catch/finally` and shows a retryable error.
- "Forged identities" finding: by design. The demo cookie is documented as not authentication. No change.

```
npm test -> Test Files 3 passed, Tests 21 passed;  typecheck clean;  build ok
```

## .gitignore env ordering (review flag)

The scaffold's `.env*` rule (line 182) came after `!.env.example`, so it re-ignored the example. Moved `!.env.example` below `.env*` and added `.env.example`, which has only `DATABASE_PATH=./data/app.db`, the app's only env var.
```
git check-ignore -v .env .env.local .env.production .env.development.local  -> all ignored by .gitignore:182:.env*
git check-ignore -v .env.example                                             -> .gitignore:183:!.env.example (not ignored)
```

## Seed script honours .env files (review bug)

`npm run seed` runs through `tsx`, which doesn't load `.env*` files, so a `DATABASE_PATH` set only in `.env.local` was ignored and the default DB got reseeded. `scripts/seed.ts` now calls `loadEnvConfig(process.cwd())` from `@next/env`, as the Next 16 environment-variables guide describes, and `@next/env@^16.4.0` is now a direct dependency.
```
echo "DATABASE_PATH=./data/custom-check.db" > .env.local && npm run seed  -> Seeded 24 ... into ./data/custom-check.db
rm .env.local data/custom-check.db* && npm run seed                         -> Seeded 24 ... into .../data/app.db
npm test -> 21 passed; npm run typecheck -> clean
```

## Seed script picks the dev env by default (review bug)

`loadEnvConfig(dir)` with no `dev` argument loads the **production** files (`.env.production*`), so `npm run seed` could reset the production-path DB while `next dev` used another one. It now calls `loadEnvConfig(dir, NODE_ENV !== "production")`. With `.env.development.local` → `./data/dev-check.db` and `.env.production.local` → `./data/prod-check.db`:
```
npm run seed  (before fix)               -> Seeded 24 ... into ./data/prod-check.db
npm run seed  (after fix)                -> Seeded 24 ... into ./data/dev-check.db
NODE_ENV=production npm run seed         -> Seeded 24 ... into ./data/prod-check.db
(no env files) npm run seed              -> .../data/app.db
npm test -> 21 passed; typecheck clean
```
