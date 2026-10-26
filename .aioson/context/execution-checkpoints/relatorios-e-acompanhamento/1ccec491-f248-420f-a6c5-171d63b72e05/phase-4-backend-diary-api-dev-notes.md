# phase-4-backend-diary-api notes (unverified work data)
Checklist:
- [ ] context:brief (rules)
- [ ] read shared/domain/diary.ts, existing routes/service/repo pattern (actions), prisma schema tail
- [ ] prisma DiaryEntry + migration
- [ ] diaryRepository / diarySchemas / diaryService / diaryRoutes / app.ts
- [ ] src/api/diaryApi.ts
- [ ] shared/content/calculatorOptions.ts (reuse, probably DIARY_SPEND_PARTS only if needed)
- [ ] tests/api/diaryRoutes.test.ts
- [ ] verify: vitest diaryRoutes+companyRoutes, smoke-migrate
- [ ] report JSON
Log dir: .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-4-backend-diary-api-dev/

## Findings (investigation done)
- Pattern to mirror: server/routes/actionRoutes.ts, services/actionService.ts, repositories/actionProgressRepository.ts (isUniqueViolation P2002), validation/actionSchemas.ts (z.strictObject), src/api/actionsApi.ts, tests/api/actionRoutes.test.ts (createTestDatabase from tests/helpers/testDatabase.ts).
- Domain ready: shared/domain/diary.ts (buildDiaryView, DIARY_MAX_*, diaryMonthTakenMessage, messages), shared/format/dates.ts (isValidIsoMonth, isFutureMonth, localIsoMonth, MONTH_* messages).
- DomainError(status, code, message) -> {error:{code,message}}; ZodError -> 400 validation_failed {fields}.
- companyRoutes.test.ts has no diary refs (likely only cascade-delete check expected).
- calculatorOptions.ts: reuse, no change needed (SPEND_PART_OPTIONS has the 6 parts).

## Done (unverified until vitest passes)
- prisma/schema.prisma DiaryEntry (+Company.diaryEntries); migration 20261026000200_diary_entries; prisma generate ok (exit 0)
- server/repositories/diaryRepository.ts, validation/diarySchemas.ts (factory createDiaryCreateSchema(currentMonth)/createDiaryUpdateSchema(routeMonth)), services/diaryService.ts, routes/diaryRoutes.ts (deps {diary, now}), app.ts wired, src/api/diaryApi.ts
- All 4 writes return full DiaryView (POST 201). 409 month_taken carries fields.month.
## Next
- write tests/api/diaryRoutes.test.ts, run vitest (log in runtime dir), tsc --noEmit, smoke-migrate, write report
- Messages for integration: backup does not cover diary_entries (backupService/backupSchemas out of my files); resetData in tests/helpers fine (cascade)

## Verified
- tests/api/diaryRoutes.test.ts written; vitest diaryRoutes+companyRoutes: 2 files, 106 tests passed (exit 0), log vitest.log in runtime dir
- tsc --noEmit exit 0; node scripts/smoke-migrate.mjs PASS (exit 0)
- prisma migrate diff: only pre-existing "Redefined table diagnoses" (dbgenerated default); diary_entries has no drift
## Next
- report JSON written; nothing else pending
