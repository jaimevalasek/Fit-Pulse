# phase-1-frontend-shell QA notes (run 8ab9f18d)

## Checklist
- [x] C1 `pnpm build` foreground -> exit=0 (log + exit in temp dir phase-1-frontend-shell-qa/build.log, build.exit)
- [x] C2 dist/ fonts: 40 @font-face, Inter (28 refs) and JetBrains Mono (12 refs), 74 woff/woff2 files in dist/assets
- [x] C3 dist/ external URLs: none in CSS url()/@import/http(s); dist/index.html has no external href/src
- [x] C4 Source font chain: tokens.css --font-structure=Inter, --font-machine=JetBrains Mono; main.tsx imports @fontsource (inter 400/500/600/700, jetbrains-mono 400/500)
- [ ] C5 Read unit files App.tsx, AppShell.tsx, button.tsx, main.tsx (bounded) for local defects
- [ ] C6 Write report JSON to reports path

## Findings so far
- None blocking. vite.config.ts: PORT/BACKEND_PORT read from env, fallbacks only, no hardcoded port (OK).
- Implementer notes (PendingScreen routes, missing theme toggle/tour) are low-severity, deferred to later units/Phase 3, not defects of this unit.

## Progress
- Temp dir: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-frontend-shell-qa/
- Investigation tool calls used: ~5 of 6 before next note update.

## Next action
- Read App.tsx, AppShell.tsx, main.tsx, button.tsx (C5).

## Update (after C4/C5)
- [x] C5 Read App.tsx, AppShell.tsx, main.tsx, button.tsx: no local defects (HashRouter, skip link, sr-only focus, Button type default, Slot asChild).
- [x] Tailwind utilities used by shell/button present in built CSS (bg-surface, text-bronze, bg-bronze, text-bronze-contrast, bg-gold, border-danger, min-h-(--control), min-h-(--touch), duration-(--fast), ease-app). Tokens defined in tokens.css (peril, peril-contrast, control, touch, fast, ease).
- corrections[]: none (no defect found in unit files).
- Deferred (verification_not_run, medium): tests/e2e/shell.spec.ts runtime AC-dm-43/50 needs playwright config + backend (integration); Play dev-link needs Play desktop.
- Next action: grep V-Stage/ tests/e2e presence, check requestGuards (integration note), then write report JSON.

## Final (QA done)
- [x] C5/C6 Report written: C:\dev\playapps\v-stage\.aioson\context\reports\diagnostico-maturidade\8ab9f18d-b196-4f87-b640-79ae0dda3f37\phase-1-frontend-shell-qa.json (valid JSON, verdict PASS, corrections[] empty)
- tests/e2e/ absent; server/http/requestGuards.ts absent -> deferred to integration (findings kind verification_not_run, medium)
- Verdict: PASS for local Done-when (pnpm build exit 0 + dist fonts/no external URL).
