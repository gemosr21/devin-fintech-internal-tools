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
