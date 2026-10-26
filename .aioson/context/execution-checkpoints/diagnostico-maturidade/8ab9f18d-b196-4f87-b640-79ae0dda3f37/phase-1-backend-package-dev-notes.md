# phase-1-backend-package — dev notes (unverified work data)

## Checklist
- [x] system.json written (slug/name/version/description mirrored from manifest.json; no build_command)
- [x] `aioson system:package . --dry-run` exit 0 (49 files; no data/, *.db, pnpm-lock; only prisma migration_lock.toml matches "lock") — log in runtime/execution-temp/.../dry-run-1.log
- [x] scripts/smoke-boot.mjs written + node --check OK. Exports: runPnpm, findFreePorts, startApp, stopApp, httpGet, waitUntil, checkServing, assertPortsClosed. Main guarded by entry check.
  - real run: FAILS only because server/main.ts does not exist yet (other unit) — boot-real-1.log
  - mechanics verified in scratch fake app ($TEMP/fp-scratch-boot.*, path in scratch-boot-path.txt): positive PASS; negative (listen 0.0.0.0) FAIL with right message; no leftover processes after kill.
- [ ] scripts/smoke-store-package.mjs (imports helpers from smoke-boot.mjs)
- [ ] node --check x2
- [ ] report JSON at .aioson/context/reports/diagnostico-maturidade/8ab9f18d-.../phase-1-backend-package.json
- [ ] cleanup: rm $TEMP/fp-scratch-boot.* and any $TEMP/fitpulse-* left; remove .aioson/system-packages if created by smoke

## Findings (concrete)
- aioson CLI src: C:\Program Files\nodejs\node_modules\@jaimevalasek\aioson\src\commands\store-system.js (collectSystemFiles ~L420, runSystemPackage ~L720).
- system:package (non --build) writes descriptor `.aioson/system-packages/<slug>/<slug>-<version>.json` = {manifest, files{rel: text}}; skips lockfiles + aioson-models.json, honors .gitignore, drops *.test/*.spec + __tests__; DOES NOT skip tests/ helpers (tests/helpers, tests/e2e/support, tests/fixtures travel); dist/ skipped in source mode (postinstall rebuilds it); rewrites package.json version to match system.json.
- package also carries AGENTS.md/CLAUDE.md/OPENCODE.md/plans/*.md/.aioson/squads/memory.md (harmless, not mine).
- .env at project root holds a key but is gitignored => not in package list (verified in dry-run list).
- server/main.ts missing at time of work -> full boot + store-package app boot cannot run now.
- pnpm 11.21.0, node 24.19; Windows: spawn pnpm via node + <nodejs>/node_modules/pnpm/bin/pnpm.cjs; kill tree with taskkill /T /F.

## Next
- write smoke-store-package.mjs (aioson system:package ., materialize, pnpm install --no-frozen-lockfile, SQL seed via APP_ROOT better-sqlite3, boot v1, overlay + synthetic ALTER migration, install, boot v2, verify data)

## DONE (final)
- node --check x2 = 0; dry-run = 0 (70 files, clean); real smoke-boot PASS; real smoke-store-package PASS (server/main.ts landed from sibling).
- Report written: .aioson/context/reports/diagnostico-maturidade/8ab9f18d-.../phase-1-backend-package.json (verdict PASS).
- Left behind: fp-scratch-boot.* in OS temp (delete was denied) — path in runtime/execution-temp/.../scratch-boot-path.txt.
