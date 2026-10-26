# phase-1-frontend-primitives — dev notes
started_at: 2026-10-23T03:37:17Z
## Checklist
- [x] ui/alert-dialog.tsx, ui/input.tsx, ui/label.tsx
- [x] feedback/ConfirmDialog.tsx, feedback/StatusView.tsx
- [x] form/TextField.tsx, form/CnpjField.tsx, form/MoneyField.tsx
- [x] api/httpClient.ts
- [x] pnpm build exit 0 (log under runtime/execution-temp/.../phase-1-frontend-primitives-dev/)
- [x] report JSON
## Findings
- Existing: src/lib/utils.ts (cn), src/components/ui/button.tsx (buttonVariants: default|metal|gate|destructive|ghost|link). Tailwind colors: ground, ground-sunken, surface, solid, text(-soft/-muted), line(-strong), bronze, gold, ok, danger(-wash), scrim. No tw-animate-css/lucide -> inline SVG, no animate-in classes.
- shared/format/cnpj.ts: maskCnpjInput(raw, caret, prev)->{value,caret}, getCnpjError(v) (empty->null), isValidCnpj, CNPJ_MASK_LENGTH=18. money.ts: maskMoneyInput(raw,caret,prev)->{value,caret,cents}, formatMoney(null)="não calculado" (use "" for null in field), parseMoney.
- server/http/errorHandler.ts not written yet -> httpClient assumes { error: { code, message, details?, requestId? } }, tolerates string error. Tell integration.
- Prototype: .field gap4 mb16; .input h-control px12 border line-2 bg tinta-2, aria-invalid danger border+wash, .is-valid patina; .err min-h 1.25em reserved; .modal w min(560px) bg solido border r-lg p24, .modal-foot justify-end gap12; .empty-block p24 dashed border r-lg bg surface.
- Edits done: all 9 files written. TextField exports TextField + useCaretRestore (shared caret hook for Cnpj/Money). ConfirmDialog: aria-disabled while busy, ignores event.detail>1 (double-click guard), stays open until onConfirm promise resolves, shows error inline.
- Next: pnpm build -> log build.log + build.exit in runtime dir.
- Verified: pnpm build exit 0 (build.log/build.exit). Report written, verdict PASS. Done.

## Rework r1 (attempt 2b20f019) — 415 json_required on body-less writes
- [x] repro script (runtime temp dir; tests/ not in write paths) shows POST without body lacks Content-Type
- [x] fix httpClient.request: Content-Type application/json + body "{}" on every POST/PUT/PATCH
- [x] same root: server error extras (`fields`, `pendingBlocks`) dropped -> details = error.details ?? extras (CompanyFormDialog reads details.fields, diagnosesApi reads details.pendingBlocks)
- [x] repro passes, pnpm build exit 0, report r1.json
- Findings: server/http/requestGuards.ts:34 requireJsonWrites (415); errorHandler sends { error: { code, message, fields?, ...extra } }.
- Edits: src/api/httpClient.ts JSON_WRITE_METHODS (Content-Type + body `options.body ?? {}` on POST/PUT/PATCH), readErrorDetails (details = error.details ?? extra keys).
- Verified: repro-before exit 1 (7 FAIL: 415 x5, fields, pendingBlocks); repro-after exit 0 (12 PASS); pnpm build (tsc+vite) exit 0. Logs in runtime dir. Report r1.json written. Done.
