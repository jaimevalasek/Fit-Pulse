# phase-1-frontend-companies — dev notes (attempt after upstream_contract_repair)
started_at: 2026-10-23T03:45:00Z
## Checklist (previous attempt: all 5 files done, build PASS, rules:check 0)
- [x] Repair finding: httpClient.ts:90-101 already sends Content-Type application/json + body `{}` on every POST/PUT/PATCH (fixed upstream, mtime 01:21). archiveCompany/restoreCompany (companiesApi.ts) need no change.
- [x] server/http/requestGuards.ts WRITE_METHODS = POST/PUT/PATCH (DELETE exempt) -> deleteCompany fine
- [x] probe: temp probe.test.ts (real companiesApi+httpClient vs real createApp) via vitest --config temp -> exit 0, 1 test passed (probe.log, probe.exit)
- [x] pnpm build exit 0 (build.log, build.exit)
- [x] report JSON (attempt1, PASS)
## Next action
done
## Findings for integration (unchanged)
- error.fields vs error.details mapping; onStartDiagnosis unwired (IF-003); last result link needs latest completed id
