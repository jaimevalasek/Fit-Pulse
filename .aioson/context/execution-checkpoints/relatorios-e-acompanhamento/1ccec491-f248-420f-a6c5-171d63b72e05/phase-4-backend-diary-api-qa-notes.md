# phase-4-backend-diary-api — QA lane notes (backend)

Unit: phase-4-backend-diary-api (CAP-ra-diary, CAP-ra-diary-prefill; AC-ra-39, AC-ra-43; IF-006)
Attempt: fc617d6b-2947-48c0-9b3f-d9c847808473
Report: .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-4-backend-diary-api-qa.json
Temp logs: .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-4-backend-diary-api-qa/

## Checklist
- [ ] C1 Read unit files (bounded): prisma/schema.prisma (DiaryEntry), migration.sql, diaryRepository.ts, diarySchemas.ts, diaryService.ts, diaryRoutes.ts, app.ts (diary mount), src/api/diaryApi.ts, tests/api/diaryRoutes.test.ts
- [ ] C2 Run verification 1: pnpm exec vitest run tests/api/diaryRoutes.test.ts tests/api/companyRoutes.test.ts (log + exit code in temp dir)
- [ ] C3 Run verification 2: node scripts/smoke-migrate.mjs (log + exit code)
- [ ] C4 Check AC-ra-39 (validation, 409 month_taken, no write on refusal) and AC-ra-43 (cents, limits) in code vs tests
- [ ] C5 Check IF-006 shape vs shared/domain/diary.ts buildDiaryView; check messages[] claims
- [ ] C6 Decide corrections (max 3 unit files) only for simple local defects; re-run
- [ ] C7 Write JSON report; final message

## Findings / edits
- C2 done (foreground, sync): vitest diaryRoutes+companyRoutes -> 2 files, 106 tests passed. Log: phase-4-backend-diary-api-qa/vitest.log, EXIT=0.
- C3 done (foreground, sync): node scripts/smoke-migrate.mjs -> 5/5 PASS. Log: phase-4-backend-diary-api-qa/smoke-migrate.log, EXIT=0.
- No edits yet. Nothing failing so far.
- C4 read (no defects found): server/services/diaryService.ts (create: no pre-read, P2002->409 month_taken w/ fields.month; update/remove 404 diary_month_not_found); server/routes/diaryRoutes.ts (POST 201, PUT/DELETE/GET; validate before service so refusals write nothing); server/validation/diarySchemas.ts (centsSchema int 0..DIARY_MAX_SPEND_CENTS; newCustomers 0..99999; checkValues parts XOR total; checkNewMonth required/invalid/future; PUT month locked); server/repositories/diaryRepository.ts (P2002 -> null, P2025 -> null, toData DbNull, BigInt total); server/app.ts:75 mounts createDiaryRoutes with createDiaryService({prisma}).
- Minor (not defects): POST route uses localIsoMonth(now()) ?? "" fallback; PUT does not validate :month format (unknown month -> 404, fine).
- C5 done: src/api/diaryApi.ts matches IF-006 (4 calls, whole DiaryView); prisma DiaryEntry + migration SQL match (unique companyId+month, cascade, BigInt total); tests use createApp + real test DB (server/db/prismaClient), Promise.all race test present, typeof=integer check present.
- FINDING (medium, out of unit scope): phase-2-backend-evolution asked this unit to pass period.diary into prepareEvolution in server/services/reportService.ts. grep shows no 'diary' in reportService.ts. File is not in this unit's write list and is concurrently owned by phase-2-backend-portfolio -> report as finding + integration message, do not edit.
- Corrections: none planned (no defect in unit files found).

## Verification results
- vitest (2 files, 106 tests) exit 0
- smoke-migrate exit 0 (PASS)

## Next small action
DONE. Report written: .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-4-backend-diary-api-qa.json (verdict PASS, 0 corrections, 1 medium contract_gap finding, 1 medium verification_not_run). Only remaining step: final message.
