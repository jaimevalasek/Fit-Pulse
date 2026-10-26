# phase-5-backend-preferences dev notes

## Checklist (all done)
- [x] server/validation/preferenceSchemas.ts: reevaluationIntervalDays (z.literal of 60/90/120/180), tourSeenVersion (int 0..99, TOUR_SEEN_VERSION_MAX)
- [x] server/services/preferenceService.ts: keys reevaluation_interval_days / tour_seen_version; defaults 90 and 0; bad stored value reads as default
- [x] src/api/preferencesApi.ts: both fields + ReevaluationIntervalDays type
- [x] shared/domain/followUp.ts: formatDays, reevaluationCountdown, reevaluationTimeline added (reevaluationOf already existed)
- [x] tests/unit/followUp.test.ts, tests/api/preferenceRoutes.test.ts extended
- [x] verify: pnpm exec vitest run tests/api/preferenceRoutes.test.ts tests/unit/followUp.test.ts -> exit 0, 2 files, 79 tests
- [x] pnpm typecheck exit 0; brandRoutes + homeRoutes tests exit 0 (75 tests)
- [x] report JSON written

Logs: .aioson/runtime/execution-temp/.../phase-5-backend-preferences-dev/{final,typecheck,neighbours}.{log,exit}
