# phase-1-frontend-shell — dev notes

## Checklist
- [ ] context:brief (must_load rules)
- [ ] read prototype tokens/shell (bounded)
- [ ] vite.config.ts, index.html
- [ ] tokens.css, global.css
- [ ] main.tsx (fontsource imports), App.tsx (HashRouter), AppShell.tsx
- [ ] components.json, lib/utils.ts, ui/button.tsx
- [ ] pnpm build exit 0 (log under .aioson/runtime/execution-temp/.../phase-1-frontend-shell-dev/)
- [ ] dist/ has Inter + JetBrains Mono woff2, no external URL
- [ ] report JSON

## Findings
- package.json (backend lane): build = `tsc --noEmit && vite build`; tsc includes server/shared/tests -> sibling errors may fail build.
- [x] context:brief loaded (english identifiers; small files). Prototype tokens at prototype.html:12-50 (dark default, light via :root[data-theme="light"]), shell markup :451-464, responsive :397-443.
- tsconfig types include vite/client; TS 7.0.2; fontsource 5.3.0 weight css (400.css etc.) available.
- App.tsx is later edited by phase-1-frontend-companies/questionnaire/result -> shell gives route table with pending elements for #/empresas, #/empresa/:id, #/diagnostico/:id, #/resultado/:id + NotFound.
- Decision: vite proxy changeOrigin=false so backend Host guard sees original Host (127.0.0.1:PORT) -> backend guard must accept PORT too (message integration).
- Decision: token names in English (ground/surface/text/bronze/gold...), Tailwind @theme inline; --color-*/--shadow-* reset (no blue, depth by borders).
- [x] WROTE (unverified): vite.config.ts, index.html (no favicon/external link), src/styles/tokens.css, src/styles/global.css, src/main.tsx, src/App.tsx, src/components/layout/AppShell.tsx, components.json, src/lib/utils.ts, src/components/ui/button.tsx (variants default/metal/gate/destructive/ghost/link).
- NEXT: pnpm build -> log .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-frontend-shell-dev/build.log + build.exit
- VERIFIED: `pnpm build` (tsc --noEmit && vite build) exit 0 -> build.log/build.exit. dist-check.json: inter latin woff2 x4 (400-700), jetbrains-mono latin woff2 x2 (400,500), 40 @font-face, 0 external CSS url(), 0 external html refs; JS http strings only react error docs/xml namespaces/router doc text (not fetched). No tailwind blue palette in CSS.
- preview-probe: vite preview on 127.0.0.1:5791 served title FitPulse + font/woff2 200; process exit 127 came from a libuv assertion at Node exit on Windows after child.kill (result printed ok). Host-header probe invalid (fetch can't override Host) -> not evidence.
- DONE: report written (PASS).
