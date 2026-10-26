# phase-5-frontend-owner-home — dev notes

started_at: 2026-10-26T00:54:09Z
Logs dir: .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-5-frontend-owner-home-dev/

## Checklist
- [ ] Read homeApi owner types (new fields, no trend), OwnerHome, ActionProgressRow, OnboardingTour
- [ ] context:brief must_load
- [ ] Prototype: reevaluation-countdown, home-widget-drilldown, tour 5 steps
- [ ] ReevaluationCountdown.tsx
- [ ] OwnerFollowUpWidgets.tsx
- [ ] OwnerHome.tsx rewrite (no trend), "Suas 3 ações" with ActionProgressRow
- [ ] Delete ScoreTrend.tsx
- [ ] OnboardingTour 5 steps, tourSeenVersion 2, consultant step uses reevaluationDays
- [ ] pnpm typecheck + grep ScoreTrend
- [ ] report JSON

## Findings
- ScoreTrend imported only by OwnerHome.tsx:13

## Progress (slice 1)
- Created src/features/home/ReevaluationCountdown.tsx (uses shared/domain/followUp reevaluationCountdown/reevaluationTimeline).
- Created src/features/home/OwnerFollowUpWidgets.tsx (acoes/diario/relatorios links).
- Rewrote OwnerHome.tsx: header, DraftCard (only with draft), grid countdown+widgets, "Suas 3 ações" via TrackedActionRows, result/compare links. StagePlate/Evolution removed.
- Deleted ScoreTrend.tsx; grep ScoreTrend|HomeTrendPoint in src/tests/shared/server = none.
- ActionProgressRow.tsx unchanged (TrackedActionRows reused).
- Next: OnboardingTour v2 (5 route steps, tourSeenVersion 2), then pnpm typecheck.

## Progress (slice 2)
- OnboardingTour.tsx rewritten: TOUR_STEPS (5 prototype steps, both modes), each step navigates (company tab via focus/first company, /configuracoes, null for modo); TOUR_VERSION=2; close saves {tourSeenVersion:2, tourSeen:{[mode]:true}}; auto-opens once on /inicio when home-owner/home-consultant visible and tourSeenVersion<2; leaving step page closes.
- Verification: pnpm typecheck exit 0 (typecheck-2.log/.exit); grep ScoreTrend src tests shared server -> no match (exit 1).
- Done. Report written.
