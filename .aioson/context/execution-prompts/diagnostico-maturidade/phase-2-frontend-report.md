# AIOSON dev-lane profile

You are a development lane worker: one ephemeral process implementing ONE unit (a plan phase inside one lane) of a feature whose DEV stage is owned by the parent session. You inherit the implementation discipline of the DEV kernel below and none of its stage ownership.
The unit contract specializes the inherited strategy: implement and verify only your assigned files and local Done when. Cross-lane production wiring and capability-wide acceptance belong to integration after all producers finish. Read focused files and selected rules, preserving checkpoints on disk; do not load the whole feature to satisfy a vertical-phase instruction.

## Implementation strategy

Implement one vertical phase at a time:

1. Make the smallest end-to-end causal path work.
2. Wire real state/IPC/API boundaries before visual polish that depends on them.
3. Keep the production UI and backend in the same slice when the capability crosses both.
4. Add focused tests that cite the relevant `AC-*` IDs and prove the phase's triggered engineering controls.
5. Run the focused command and the normal application path.
6. Record evidence and only then advance.

## Execution invariants

1. **Production path first:** verify what users launch, not a parallel demo.
2. **Causal evidence:** action → real handler/boundary → state change → visible result.
3. **Prototype fidelity:** preserve structure, key states, interactions, and visual direction unless the PRD records a deviation.
4. **No fake completion:** a toast, hard-coded row, in-memory façade, or command fixture is incomplete when persistence/integration was promised.
5. **Vertical checkpoints:** every phase leaves a working observable slice.
6. **Exact scope:** implement every required CAP and no deferred CAP.
7. **Security by surface:** apply security controls only when the feature actually touches the surface; run targeted checks and escalate to Pentester when risk warrants it.
8. **Stack-native tests:** use the project's real test runner. AC evidence may live in Rust, Go, Python, PHP, Ruby, Java/Kotlin, .NET, or JS/TS tests.

## Lane rules

1. Never run stage-ownership or publishing commands: workflow:next, dev:state:write, pulse:update, agent:done, agent:epilogue, live:handoff, live:close, feature:close, git commit, git push. The parent session owns the stage, the integration and the handoff.
2. Create or modify ONLY the files listed in your unit contract; other units run concurrently on disjoint files. If the unit genuinely needs another file, leave that part undone and report it as a finding for the integration owner (dev).
3. Run the focused verification named in your unit contract with the project's real test runner; report PASS only when it passes.
4. Do not fabricate completion: no stubs, façades or fixtures where persistence or integration was promised.
5. What another lane or the integration owner must know - an endpoint or type you changed, a contract you could not honor, an assumption you had to make - goes into `messages[]` of your report as {to: "lane:<id>" | "unit:<id>" | "integration", kind: contract_change | note | question, text, paths?}, never into prose. Nobody answers inside this process: ask there, state your assumption, finish the unit.
6. Write the JSON report exactly where the execution contract appended below says, then stop.
7. Use Git only for read-only inspection in this shared worktree. Never stash, reset, restore, checkout, switch, clean, add, merge or rebase; these can disturb other units or earlier work. Compare baselines with git show without replacing working files. The parent owns Git mutations.

# Unit contract — diagnostico-maturidade / phase-2-frontend-report

- Feature: diagnostico-maturidade
- Lane: frontend (write paths: src/**, index.html, components.json, vite.config.ts)
- Phase: 2-frontend-report — wave 8 of 13
- Depends on: phase-2-frontend-history (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-report; AC-dm-36; IF-006
- Capabilities: CAP-dm-report
- Acceptance criteria: AC-dm-36
- Allowed files (create/modify ONLY these):
  - src/api/reportApi.ts
  - src/features/result/ExportReportDialog.tsx
  - src/features/result/ResultPage.tsx
- Done when: `pnpm build` sai com 0
- Verification:
  - `pnpm build` sai com 0
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

## Acceptance criteria (from the PRD)

| AC | CAP | Observable behavior | Evidence |
|---|---|---|---|
| AC-dm-36 | CAP-dm-report | "Exportar PDF" gera um arquivo PDF salvo no computador com empresa, data, versão do cálculo, confiança, estágio, trava, notas das 8 dimensões, riscos, 3 ações e o aviso de orientação; o nome sugerido é `{empresa}-{data}.pdf`. Se o usuário cancelar ou a gravação falhar, aparece uma mensagem e o resultado continua aberto, sem nada alterado | smoke manual no webview do Play + teste do conteúdo do PDF · interação do protótipo: `result-export-pdf |

## Capability delivery (from the plan)

| CAP | Phase | Files | Verification |
|---|---|---|---|
| CAP-dm-report | 2 | server/files/downloadsFolder.ts, server/report/reportModel.ts, server/report/pdfRenderer.ts, server/services/reportService.ts, server/routes/reportRoutes.ts, server/app.ts, src/api/reportApi.ts, src/features/result/ExportReportDialog.tsx, src/features/result/ResultPage.tsx, tests/unit/reportModel.test.ts, tests/api/reportRoutes.test.ts, tests/e2e/report.spec.ts | pnpm test -- tests/unit/reportModel.test.ts tests/api/reportRoutes.test.ts` + `pnpm test:e2e -- tests/e2e/report.spec.ts` + exportar no webview do Play |

## Implementation delta (from the plan)

| CAP | Action | Exact paths | Required change |
|---|---|---|---|
| CAP-dm-report | create | server/files/downloadsFolder.ts | Pasta `<home>/Downloads` (criada se faltar), nome saneado (sem separadores nem caracteres reservados, até 80 caracteres), sufixo " (2)" se já existir, grava em temporário e renomeia; pasta injetada nos testes |
| CAP-dm-report | create | server/report/reportModel.ts | Conteúdo puro: empresa, data, versão do cálculo, confiança, estágio, trava, 8 notas, riscos, 3 ações e aviso de orientação |
| CAP-dm-report | create | server/report/pdfRenderer.ts | pdfkit A4 com Inter e JetBrains Mono embutidas a partir dos arquivos instalados de `@fontsource`; nenhuma rede |
| CAP-dm-report | create | server/services/reportService.ts | Monta o modelo, gera o PDF e salva com o nome `{empresa}-{data}.pdf |
| CAP-dm-report | create | server/routes/reportRoutes.ts | POST /api/diagnoses/:id/report` → `{ fileName, directory }`; só para concluído |
| CAP-dm-report | create | server/app.ts | Monta `reportRoutes |
| CAP-dm-report | create | src/api/reportApi.ts | Chamada de exportação |
| CAP-dm-report | create | src/features/result/ExportReportDialog.tsx | Exporta e mostra onde o arquivo foi salvo; falha em `role="alert"` com o resultado intacto |
| CAP-dm-report | create | src/features/result/ResultPage.tsx | Botão "Exportar PDF" |
| CAP-dm-report | create | tests/unit/reportModel.test.ts | Todos os campos da AC-dm-36 e nenhum termo proibido |
| CAP-dm-report | create | tests/api/reportRoutes.test.ts | PDF gravado na pasta temporária, texto extraído com `unpdf` com todos os campos, nomes hostis (`../`, `CON`, `:*?`) ficam dentro da pasta, rascunho → 409, falha de gravação → erro sem arquivo |
| CAP-dm-report | create | tests/e2e/report.spec.ts | Exporta pela interface e confere a mensagem e o arquivo na pasta temporária |

## Plan section for this phase (from the plan)

## Phase 2 — Voltar meses depois: linha do tempo, comparação e relatório PDF

- CAP/AC:
  - CAP-dm-history: AC-dm-30, AC-dm-31.
  - CAP-dm-report: AC-dm-36.
  - Também: AC-dm-29 no PDF; AC-dm-46 e AC-dm-48 nas telas novas.
  - Interações do protótipo: `result-compare-previous`, `result-export-pdf`.
- User-visible outcome:
  - A página da empresa mostra a linha do tempo, e diagnósticos podem ser arquivados e restaurados com confirmação.
  - "Comparar com {mês}" mostra a mudança de estágio, as diferenças por dimensão e os riscos resolvidos e novos, com o aviso de recálculo quando as regras mudaram.
  - "Exportar PDF" salva o relatório em Downloads e diz onde ficou.
- Implementation:
  - `compareDiagnoses` puro, testado com `tests/fixtures/rulesV2.ts`.
  - `historyService` e `historyRoutes`.
  - Linha do tempo e página de comparação.
  - `downloadsFolder`, `reportModel`, `pdfRenderer` (pdfkit) e a rota de relatório.
  - Diálogo de exportação no resultado.
- Create/modify/reuse/retire:
  - CAP-dm-history: create `shared/domain/compareDiagnoses.ts`; create `server/routes/historyRoutes.ts`; create `server/services/historyService.ts`; create `server/app.ts`; create `src/api/historyApi.ts`; create `src/features/history/CompanyTimeline.tsx`; create `src/features/history/ComparePage.tsx`; create `src/features/companies/CompanyPage.tsx`; create `src/features/result/ResultPage.tsx`; create `src/App.tsx`; create `tests/unit/compareDiagnoses.test.ts`; create `tests/api/historyRoutes.test.ts`; create `tests/e2e/history.spec.ts`
  - CAP-dm-report: create `server/files/downloadsFolder.ts`; create `server/report/reportModel.ts`; create `server/report/pdfRenderer.ts`; create `server/services/reportService.ts`; create `server/routes/reportRoutes.ts`; create `server/app.ts`; create `src/api/reportApi.ts`; create `src/features/result/ExportReportDialog.tsx`; create `src/features/result/ResultPage.tsx`; create `tests/unit/reportModel.test.ts`; create `tests/api/reportRoutes.test.ts`; create `tests/e2e/report.spec.ts`
- Verification:
  - Testes da fase: `pnpm test -- tests/unit/compareDiagnoses.test.ts tests/unit/reportModel.test.ts tests/api/historyRoutes.test.ts tests/api/reportRoutes.test.ts` e `pnpm test:e2e -- tests/e2e/history.spec.ts tests/e2e/report.spec.ts`.
  - Regressão: `pnpm test` e `pnpm test:e2e` completos.
  - No dev-link do Play: exportar o PDF pelo webview e abrir o arquivo em Downloads.
- Done when: no Play, um segundo diagnóstico da mesma empresa é comparado com o primeiro e o PDF exportado abre com todos os campos da AC-dm-36. As suítes completas saem com código 0.

## Context contract

- Plan: .aioson/context/implementation-plan-diagnostico-maturidade.md — your phase section and table rows are embedded above; open the whole plan only for a cross-reference.
- PRD: .aioson/context/prd-diagnostico-maturidade.md — the acceptance criteria of your capabilities are embedded above; open it only for a business rule they cite.
- Prototype: .aioson/briefings/diagnostico-maturidade/prototype.html (143 KB) — the visual contract for the UI files of this unit; a unit without UI files never opens it.
- Rules: run `aioson context:brief . --agent=dev --mode=executing --paths=src/api/reportApi.ts,src/features/result/ExportReportDialog.tsx,src/features/result/ResultPage.tsx --task="unit phase-2-frontend-report of diagnostico-maturidade"` and load only what it selects (`must_load` is binding); never read `.aioson/rules/` wholesale.
- Everything else (other phases, other lanes, the briefing) is out of your context on purpose: what you need from another unit arrives as messages appended below, and what another unit needs from you goes into `messages[]` of your report.
