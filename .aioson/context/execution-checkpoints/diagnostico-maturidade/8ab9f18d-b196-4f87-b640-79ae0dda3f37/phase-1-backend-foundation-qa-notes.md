# phase-1-backend-foundation QA — progress notes

Unit: phase-1-backend-foundation (lane backend, wave 1). Scope: CAP-dm-play-runtime / AC-dm-40.
Done when: `pnpm install` exits 0 with no ignored build; `pnpm exec prisma validate` passes; manifest.json has no `requires_services` nor `auth`.
Verdict is written only to the report JSON path in the execution contract.

## Checklist
- [x] Unit files present (10 unit files)
- [x] Run dirs created under .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-foundation-qa/
- [x] V1 `pnpm install` (project tree) — exit 0, "Already up to date", no ignored-build line. Log: .../phase-1-backend-foundation-qa/v1-install.log (exit file v1-install.exitcode)
- [x] V1b clean `pnpm install --frozen-lockfile` in scratch copy (package.json, pnpm-workspace.yaml, pnpm-lock.yaml only) — exit 0, 378 packages, no ignored-build line, root postinstall guard printed skip warning. Log: .../v1b-clean-frozen-install.log
- [x] V2 `pnpm exec prisma validate` — exit 0, "schema ... is valid". Log: .../v2-prisma-validate.log
- [x] V3 manifest.json — no `requires_services`, no `auth` (top-level and raw grep). Log: .../v3-manifest-check.log
- [x] Code read: server/db/databaseUrl.ts, prisma.config.ts, pnpm-workspace.yaml, .gitignore ignore entries, schema generator/datasource lines — consistent with implementer report
- [x] Report JSON written to .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-foundation-qa.json

## Findings / edits
- No source edits by QA (corrections[] empty).
- Not run: real postinstall path (prepare-app.mjs absent until wave 2) — verification_not_run, medium.
- Tooling gotcha (implementer-reported, not re-run): `pnpm test -- <file>` runs full suite under pnpm 11 — note to integration.
- databaseUrl.ts: resolveDatabaseUrl() mkdirs data/ as a side effect; prisma.config.ts calls it on every Prisma CLI run — low, note only.

## Next small action
- None for the unit. Verdict PASS. Final message to parent.
