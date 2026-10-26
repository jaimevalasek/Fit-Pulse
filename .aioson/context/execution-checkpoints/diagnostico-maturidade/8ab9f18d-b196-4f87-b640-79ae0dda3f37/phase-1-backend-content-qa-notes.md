# phase-1-backend-content QA notes (attempt 31bd9ff6)

## Checklist
- [ ] Run Done-when command `pnpm test -- tests/unit/questionBank.test.ts tests/unit/forbiddenTerms.test.ts` (foreground, log in run temp dir)
- [ ] Run filtered `npx vitest run tests/unit/questionBank.test.ts tests/unit/forbiddenTerms.test.ts`
- [ ] Read unit files (shared/content/*, shared/rules/rulesV1.ts, shared/domain/types.ts) bounded
- [ ] Check tests exercise production content (no parallel fixture)
- [ ] Write report JSON

## Findings
- LOW (package.json `test` script): `pnpm test -- <files>` forwards literal `--`, so vitest runs all unit tests; Done-when still exits 0. Owned by foundation, not this unit. Recorded as finding, no edit.
- MEDIUM verification_not_run (integration): e2e for AC-dm-10/11/29 (tests/e2e/questionnaire.spec.ts, result.spec.ts) not runnable in this unit.
- Code review: tests/unit/questionBank.test.ts and forbiddenTerms.test.ts read; assertions are meaningful (8 blocks, 24 ids, unknown-label set, forbidden term scan of content modules and source).
- Independent PRD check (scratch tsx, run temp dir, exit 0, log compare-questions.log): PRD table rows 24, code 24, mismatches 0 (question text, 4 anchors, unknownLabel).

## Edits
- none (no corrections needed)

## Verification
- Done-when `pnpm test -- tests/unit/questionBank.test.ts tests/unit/forbiddenTerms.test.ts`: EXIT=0, 4 files / 146 tests passed (the `--` runs all unit tests). Log: run temp dir test-done-when.log / .exit
- Filtered `npx vitest run tests/unit/questionBank.test.ts tests/unit/forbiddenTerms.test.ts`: EXIT=0, 2 files / 18 tests passed. Log: test-filtered.log / .exit

## Next action
- Bounded code review of unit files (questionBank.ts, the two test files), then write report JSON.
