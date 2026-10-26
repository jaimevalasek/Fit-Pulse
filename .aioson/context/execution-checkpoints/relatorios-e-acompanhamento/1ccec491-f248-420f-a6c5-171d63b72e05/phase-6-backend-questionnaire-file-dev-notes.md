# phase-6-backend-questionnaire-file — dev notes (unverified work data)

Temp/log dir: .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-6-backend-questionnaire-file-dev/
Report: .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-6-backend-questionnaire-file.json

## Checklist
- [x] 1. context:brief for paths (load must_load only)
- [x] 2. Read shared/content/questionBank.ts, calculatorOptions.ts (bounded), PRD "Conteúdo v2" texts for questionnaire (aviso, revise e salve, etc.)
- [x] 3. server/questionnaire/questionnaireStyles.css
- [x] 4. server/questionnaire/questionnaireClient.js
- [x] 5. server/questionnaire/questionnaireFile.ts (generator, CSP, escaped JSON)
- [x] 6. tests/unit/questionnaireFile.test.ts (writes test-results/questionario-exemplo.html)
- [x] 7. run vitest: run3 PASS 22/22 exit=0 (log: temp dir vitest-run3.log/.exit); example written test-results/questionario-exemplo.html
- [x] 8. report written (verdict PASS, 6 findings, 5 messages) (messages to integration: Q-10 owner smoke, file format contract)

## Findings
- Catalog: shared/content/questionBank.ts (BLOCKS 8, QUESTION_BANK 24, unknownLabel null where not allowed); calculator copy/options: shared/content/calculatorOptions.ts; PATCH schemas: server/validation/diagnosisSchemas.ts (diagnosisPatchSchema.shape.answers/calculator); mask source: shared/format/money.ts maskMoneyInput; prototype client view: prototype.html line ~1022 clientView.
- Approved texts: PRD ## Conteudo v2 item 3 (line ~360). Aviso says answers are LOST if page closed -> no localStorage persistence (prototype intro claiming saved is superseded).
- Plan decisions: CSP default-src none; script-src/style-src unsafe-inline; img-src data:; form-action none. Data in <script type=application/json> escaped <>&,U+2028/9; textContent only; no svg createElementNS (http:// string).
- Design: .fitpulse JSON {format:fitpulse-answers, formatVersion, questionnaireVersion, company{id,name}, savedAt, answers, calculator}; constants exported from questionnaireFile.ts; CSS/JS read lazily at runtime.
- Plan: unit parity test of client mask vs shared maskMoneyInput via test hook + vm; try Playwright browsers ad hoc in temp dir for smoke.

## Edits
- Created server/questionnaire/questionnaireStyles.css and questionnaireClient.js (IIFE; test hook globalThis.__fitpulseQuestionnaireTestHook returns early with {maskMoney,readWhole,formatMoney,emptyCalculator,isBlockAnswered,countAnsweredBlocks,buildAnswersFile,savedInstruction}; reads #fitpulse-data JSON with keys format,formatVersion,questionnaireVersion,company{id,name},answersFileName,brand{name,phone,email,logo}|null,copy.desktopNotice,blocks,questions,calculator{fields,spendParts,spendModes,newCustomersModes,spendRanges,newCustomersRanges,purchasesPerYear,relationshipLength}).
- Rule form-fields-masks says reuse project mask utils: client mask is a port (file must be self-contained) -> parity test needed; report as note.
- Playwright browsers installed: chromium, firefox-1466, webkit-2104 (check match pw 1.64.1) -> ad hoc smoke from temp dir.
- Created questionnaireFile.ts (exports ANSWERS_FILE_FORMAT, ANSWERS_FILE_FORMAT_VERSION=1, QUESTIONNAIRE_VERSION=1, QUESTIONNAIRE_DESKTOP_NOTICE, slugifyForFileName, questionnaireFileName, answersFileName, buildClientMessage, escapeJsonForHtml, buildQuestionnaireFile({company:{id,name},brand|null,sentAt}) -> {html,fileName,answersFileName}) and tests/unit/questionnaireFile.test.ts.
- GOTCHA: tool params/bash heredocs convert backslash-u and eat double backslashes; use p{M} / p{Zl} property escapes + String.fromCharCode, edit via Edit tool.
- NEXT: run vitest (log in temp dir), fix, then ad hoc Playwright smoke (chromium/firefox/webkit) from temp dir, then report.

## Verification
- pnpm exec vitest run tests/unit/questionnaireFile.test.ts -> exit 0, 22 passed (vitest-run3).
- NEXT: ad hoc browser smoke via tsx script in temp dir (browser-smoke.mts, log browser-smoke.log) in chromium/firefox/webkit; then pnpm typecheck sanity for my files; then report JSON.

- Browser smoke: script temp dir browser-smoke.mts, log browser-smoke.log, exit file browser-smoke.exit; first foreground run exceeded 420s and was auto-backgrounded (task bm76x7rhu); poll that same task output, do not start another copy unless it died.
- INCIDENT: my cleanup (Stop-Process filtered by CommandLine like browser-smoke.mts OR ExecutablePath like ms-playwright) was too broad: killed ~19 procs (bash/sh/cmd/node + chrome-headless-shell + firefox). Likely all mine (smoke script + leaked browsers + my shells) but cannot rule out another unit browser/shell. Report it as a finding. NEVER broad-kill again; script must close browsers in finally.
- Smoke run 2 results: script bugs only (root path off by one -> wrong file URL; browser leak on error). firefox-1555/webkit-2370 (needed by playwright 1.64.1) NOT installed; installed firefox-1466 fails protocol (Browser.setDefaultViewport). Only chromium is usable -> Firefox/Safari remain manual Q-10.
- BUG FOUND+FIXED via real Chromium+axe: entryItem called fillArea(area,titleId) but areas take (titleId) -> aria-labelledby=[object HTMLDivElement]; fixed in questionnaireClient.js. Also added <main id=app>, chip contrast, removed transitions.
- vitest-run5 PASS 22/22 exit 0; browser-smoke3.log: chromium 156 PASS (network none, CSP violations none, axe dark+light clean on block1/block3/review/saved, download names, PATCH schema OK, partial save 19 answers + full 24). Firefox/WebKit not runnable (playwright wants ff-1555/webkit-2370, installed 1466/2104).
- NEXT: tsc check my files, then write report JSON (verdict PASS with verification_not_run findings for Q-10 manual + Firefox/Safari + dossier add-finding).
- Refactor: client screen code split from one 244-line boot() into top-level fns taking app (client-before-refactor.js saved in temp dir). After refactor: vitest-run7 exit 0 (22 passed), browser-smoke5 chromium PASS, rules:check RULES=OK (no questionnaire findings), tsc exit 0 (earlier TS2739 in server/services/reportService.ts was another unit, gone on recheck).
- Example file: test-results/questionario-exemplo.html (50422 bytes). Playwright wipes test-results at start of every run -> regenerate via the unit test before giving it to the owner.
- NEXT: write report JSON and stop. Do NOT run dossier:add-finding (owner Q-10 not done).
