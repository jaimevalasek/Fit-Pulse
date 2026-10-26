# phase-1-backend-package QA notes (run 8ab9f18d, attempt e206324f)

Unit: phase-1-backend-package, lane backend. Files I may correct: system.json, scripts/smoke-boot.mjs, scripts/smoke-store-package.mjs (max 3 corrections).
Report: .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-package-qa.json
Temp logs: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-package-qa/

## Checklist
- [x] C1 node --check scripts/smoke-boot.mjs -> exit 0 (before and after fix)
- [x] C2 node --check scripts/smoke-store-package.mjs -> exit 0
- [x] C3 aioson system:package . --dry-run -> exit 0; no data/, no *.db, no package lockfile (only prisma migration_lock.toml)
- [x] C4 system.json matches manifest.json (fitpulse, FitPulse, 0.1.0, description)
- [x] C5 smoke-boot.mjs review: exports present; LAN probe fixed (see edit 1)
- [x] C6 smoke-store-package.mjs review: imports APP_ROOT only (no runPackageBin; not needed by its flow); data/ and *.db covered (lines 37-38)
- [x] C7 smoke-boot.mjs real run -> PASS, exit 0 (log smoke-boot.log)
- [x] Verdict + report JSON

## Findings / edits
- EDIT 1 scripts/smoke-boot.mjs assertNotReachableFromNetwork (~line 264): accept ECONNREFUSED or timeout, fail only on connected. Reason: http-lane message (Windows drops SYN on non-loopback IPv4 -> timeout). Previous code required exact ECONNREFUSED.
- Probe on this host (probe-lan.log): loopback listener and closed port both give ECONNREFUSED on 3 LAN IPs; timeout path not reproduced here, fix is by reading + message.
- Low (dev, carried): packager ships tests/helpers/testDatabase.ts; not in Done-when.
- Low (outside unit, to integration): packager default also ships AGENTS.md, CLAUDE.md, plans/, agents/_shared/*.
- Low (dev leftover, not project): C:\Users\jaime\AppData\Local\Temp\fp-scratch-boot.W6nZSh still exists. Not deleted by QA (not in workspace, dev's scratch).

## Verification log
- C1 node --check smoke-boot.mjs exit=0 (check-boot.log, check-boot-after-fix.log)
- C2 node --check smoke-store-package.mjs exit=0 (check-store.log)
- C3 aioson system:package . --dry-run exit=0 (dry-run.log: 71 files; dry-run-after-fix.log: 75 files, exit=0, no forbidden entries)
- C7 node scripts/smoke-boot.mjs exit=0 PASS (smoke-boot.log)
- Not re-run in QA: smoke-store-package.mjs full run (outside Done-when; heavy pnpm install). Dev evidence store-real-1.log.

## Next action
Write report JSON (verdict PASS), then final message. No further work.
