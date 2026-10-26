# phase-2-frontend-history — dev notes

## Checklist
- [x] Upstream repair check: src/api/httpClient.ts request() already sets Content-Type on every JSON write method (no body needed) — not edited by this unit
- [x] src/api/historyApi.ts (timeline, archive, restore, comparison)
- [x] src/features/history/CompanyTimeline.tsx (written, split: TimelineLists, TimelineActionDialog, useRowFocus; not built yet)
- [x] src/features/history/ComparePage.tsx (exports formatMonth)
- [x] CompanyPage.tsx: CompanyDiagnosesSummary replaced by CompanyDiagnoses (note + CompanyTimeline, empty=StatusView), onChanged=reload company
- [x] ResultPage.tsx (findCompareTarget via getTimeline; header actions div for PDF unit) "Comparar com {mês}" when canCompare
- [x] App.tsx route comparar/:diagnosisId
- [~] pnpm build: exit 1 x4 only on pdfRenderer.ts (other unit); vite build 0
- [x] report JSON written (PASS + external_blocker finding)

## Findings
- Contracts: TimelineView/TimelineEntry/TimelineDraft in server/services/historyService.ts:23-56; DiagnosisComparison in shared/domain/compareDiagnoses.ts:24-76 (import type only from frontend).
- Prototype: timeline item prototype.html:930-955 (when/what/acts, archived in <details>); compare prototype.html:1082-1101; diag-archive confirm text :1291. AC-dm-30 needs confirm for restore too.
- ResultPage: Diagnosis.previous exists but may include archived; use timeline entry canCompare + previous active entry for month.
- Next: ComparePage (exports formatMonth for ResultPage), then ResultPage compare link via getTimeline, then App route
- pnpm build #1: exit 1, only server/report/pdfRenderer.ts(300,9) TS2322 (phase-2-backend-report, concurrent); vite build exit see vite.exit
- build #2 exit 1 same pdfRenderer error; rules:check RULES=OK, MED ResultPage 16 imports (was 15 before unit)
