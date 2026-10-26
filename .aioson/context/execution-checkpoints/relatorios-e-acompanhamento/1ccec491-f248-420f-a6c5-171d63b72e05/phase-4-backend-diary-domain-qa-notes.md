# phase-4-backend-diary-domain QA notes (lane backend, wave 3)

## Checklist
- [x] Run Done-when vitest (6 files) -> PASS 353 tests, exit 0 (log: phase-4-backend-diary-domain-qa/vitest-done-when.log) -> capture log + exit code in temp dir
- [ ] Read unit files: shared/domain/diary.ts, shared/format/dates.ts, shared/domain/unitEconomics.ts, shared/domain/completeness.ts, shared/domain/diaryPrefill.ts, shared/domain/types.ts, tests/unit/*
- [ ] Check AC-ra-41, AC-ra-44, AC-ra-45 coverage in unit tests
- [ ] Optional: tsc --noEmit (log + exit code)
- [ ] Write report JSON

## Findings / edits
- (none yet)

## Verification log
- vitest Done-when: 6 files, 353 tests passed, EXIT 0 (session 20:19)

## Next small action
- Run Done-when vitest command in foreground, tee to temp log, record exit code.

## Update (QA, after tsc)
- tsc --noEmit: EXIT 0 (log: phase-4-backend-diary-domain-qa/tsc.log)
- AC text (PRD lines 318-322): AC-ra-41 = cost "não calculado" at 0 customers, 6-month chart, progress "N de 3"/"Medido: de X a Y", no NaN/Infinity; AC-ra-44 = prefill sum of 3 recent months, total-only month -> single total, measured; AC-ra-45 = 1-2 months -> suggestion x3, estimated once accepted, 0 months -> v1 unchanged.
- Test locations: diary.test.ts:167 (AC-41 chart), :236 (progress), :329 (no NaN); diaryPrefill.test.ts:68/146/171/386; unitEconomics.test.ts:464.
- Unit files line counts: diary.ts 234, dates.ts 237, unitEconomics.ts 174, diaryPrefill.ts 228, types.ts 337.
- Next: read diaryPrefill.ts (rule logic) then diary.ts chart/progress, bounded.
- Read diaryPrefill.ts (228 lines): computeDiaryPrefill / applyDiaryToCalculator / applyDiarySuggestion / carryDiaryMarks match RULE-ra-09 (3+ measured sum; total-only month -> single total; 1-2 -> suggestion x3 rounded; 0 -> none). No defect found.
- Read diary.ts (234 lines): computeMonthCostCents null on 0 customers; buildDiaryChart last 6 oldest-first; computeDiaryProgress measured span; formatDiaryProgress text. No defect found.
- Note (not a defect of this unit): DIARY_MAX_SPEND_CENTS not enforced in isUsableDiaryEntry; belongs to API schema (AC-43), sibling unit.
- Next: check v1 expectations unchanged (read-only git diff if repo), then unitEconomics resolveSpendCents, then write report.

## Final review (QA)
- v1 expectations: unitEconomics.test.ts v1 describes (lines 1-465) untouched; diary block appended at 466+ (per dev notes). Not a git repo, so no baseline diff was possible; reported as agent-reported.
- dates.ts month helpers (lines 160-237) read: correct for empty/incomplete/impossible/future/valid months. No defect.
- completeness.ts: no diary/origin logic; not changed by this slice. No defect.
- AC-ra-45 confidence cap verified end-to-end in diaryPrefill.test.ts:259 (real computeConfidence).
- Cross-lane (deferred to integration, not fixed, outside unit files): server/report/reportModel.ts:465 and :486 read calculator.spendParts only, so a total-only draft shows R$ 0,00 / no parts. Confirmed by grep.
- Corrections made: none. Verdict: PASS.
- Report: .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-4-backend-diary-domain-qa.json (next action: write it, then final message)
- [x] Report JSON written and parsed (verdict PASS). Task complete.
