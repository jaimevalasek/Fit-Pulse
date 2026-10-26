# phase-1-backend-foundation (backend lane) — dev notes
Unit: package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, .gitignore, manifest.json, prisma.config.ts, prisma/schema.prisma, server/db/databaseUrl.ts
Done when: `pnpm install` exit 0 sem build ignorado + `pnpm exec prisma validate` passa + manifest sem requires_services/auth.

## Checklist
- [ ] context:brief (rules)
- [ ] inspect env: node/pnpm versions, existing .env keys (no values)
- [ ] manifest.json
- [ ] .gitignore additions
- [ ] package.json
- [ ] pnpm-workspace.yaml
- [ ] tsconfig.json, vitest.config.ts
- [ ] prisma/schema.prisma, prisma.config.ts, server/db/databaseUrl.ts
- [ ] pnpm install (exit 0) ; prisma validate ; manifest check
- [ ] report JSON

## Log
(start) workspace had only: manifest.json (V-Stage, old), .gitignore (AIOSON), .env (92B), no package.json.
- Findings: node v24.19.0, pnpm 11.21.0. .env has only OPENROUTER_API_KEY (do not read/print; Prisma 7 does not autoload .env). Wave 1 is alone: scripts/prepare-app.mjs, migrations, prismaClient (wave 2, other unit), vite.config.ts/index.html/src (frontend wave 2), system.json (wave 3) do NOT exist yet -> root postinstall must tolerate missing scripts/prepare-app.mjs (guarded node -e, loud warning) so `pnpm install` exits 0 now.
- Decisions: databaseUrl.ts exports resolveDatabaseUrl(); app root from import.meta.url; prisma.config.ts imports with explicit .ts ext (tsconfig allowImportingTsExtensions).
- [x] WROTE (unverified): manifest.json, .gitignore (appended), package.json (exact runtime deps; guarded postinstall; react-router pinned 7.18.4 because v8 needs node>=22.22 vs engines ^22.12), pnpm-workspace.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, prisma/schema.prisma (enum DiagnosisStatus, Int rulesVersion), server/db/databaseUrl.ts (resolveDatabaseUrl/resolveAppRoot/resolveDataDir).
- NEXT: run `pnpm install` (log: .aioson/runtime/execution-temp/.../phase-1-backend-foundation-dev/install.log + install.exit), then `pnpm exec prisma validate`, tsc check, manifest check, then report.
- VERIFIED (logs in execution-temp/.../phase-1-backend-foundation-dev/): `pnpm install` exit 0 (4 allowBuilds ran: better-sqlite3, esbuild, @prisma/engines, prisma; no ignored builds); `pnpm exec prisma validate` exit 0; `prisma generate` ok; `tsc --noEmit` (TS 7.0.2) exit 0; round-trip via tsx+adapter OK (Json default, enum, cascade, preferences); manifest has no requires_services/auth; .gitignore semantics checked with the `ignore` pkg.
- FIX: Prisma emitted `DEFAULT {}` (invalid SQLite) for Json @default("{}") -> now @default(dbgenerated("'{}'")) => DEFAULT '{}'.
- FINDING: pnpm 11 forwards `pnpm test -- file` literally as `vitest run -- file`; vitest then IGNORES the filter (runs all). Use `pnpm test <file>` or `pnpm exec vitest run <file>`.
- pnpm auto-added minimumReleaseAgeExclude ['@types/pdfkit@0.17.7'] to pnpm-workspace.yaml (0.17.7 published 2026-10-22). Left as-is.
- NEXT: store-sim (install w/o lockfile in scratch dir), cleanup server/generated + data/, final `pnpm install`, write report JSON.
- DONE: report written (verdict PASS). server/generated and data/ removed after checks.
