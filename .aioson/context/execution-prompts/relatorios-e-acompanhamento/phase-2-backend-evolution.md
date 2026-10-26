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

# Unit contract — relatorios-e-acompanhamento / phase-2-backend-evolution

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 2-backend-evolution — wave 5 of 14
- Depends on: phase-2-backend-brand-reports (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-evolution-report; AC-ra-12, AC-ra-13; IF-001, IF-004
- Capabilities: CAP-ra-evolution-report
- Acceptance criteria: AC-ra-12, AC-ra-13
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-11, AC-ra-14
- Allowed files (create/modify ONLY these):
  - server/services/historyService.ts
  - shared/domain/compareDiagnoses.ts
  - shared/content/comparisonCopy.ts
  - server/report/evolutionDocument.ts
  - server/validation/reportSchemas.ts
  - server/services/reportService.ts
  - tests/unit/evolutionDocument.test.ts
  - tests/fixtures/rulesV2.ts
- Done when: `pnpm exec vitest run tests/unit/evolutionDocument.test.ts tests/api/historyRoutes.test.ts tests/api/reportRoutes.test.ts` passa
- Verification:
  - `pnpm exec vitest run tests/unit/evolutionDocument.test.ts tests/api/historyRoutes.test.ts tests/api/reportRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

## Acceptance criteria (from the PRD)

| AC | CAP | Observable behavior | Evidence |
|---|---|---|---|
| AC-ra-11 | CAP-ra-diagnosis-report, CAP-ra-evolution-report, CAP-ra-portfolio-report | Nenhum PDF contém os termos proibidos da RULE-dm-14. O aviso "Orientação baseada nas respostas da empresa. Não substitui uma análise financeira." aparece no resumo e em "Como ler" | teste de unidade dos três PDFs |
| AC-ra-12 | CAP-ra-evolution-report | Com 2 ou mais diagnósticos concluídos, "Evolução" oferece "De" e "Até" (padrão: os dois mais recentes). O PDF tem:<br>• capa;<br>• "Antes e depois": estágio antes → depois, custo por cliente, média das 8 dimensões, trava antes e agora, barras antes e depois com a diferença escrita;<br>• "O que foi feito no período" (parte 2): ações do diagnóstico "De" com o estado e se continuam no plano novo, mais o custo por cliente do diário no período. Antes da parte 2, ou sem andamento e sem diário no período, essa página não aparece;<br>• "Como ler" | teste de unidade do PDF · interação do protótipo: `report-type-evolution |
| AC-ra-13 | CAP-ra-evolution-report | Para o mesmo par, os estágios, as notas e as diferenças do PDF de evolução são iguais aos da tela "Comparar". Quando as versões das regras diferem, o PDF traz o mesmo aviso de recálculo da tela (RULE-ra-02) | teste de unidade comparando o PDF com a saída da comparação, com `tests/fixtures/rulesV2.ts |
| AC-ra-14 | CAP-ra-evolution-report | A lista "Até" só oferece diagnósticos posteriores ao escolhido em "De"; trocar "De" para depois de "Até" ajusta "Até" para o seguinte | teste e2e |

## Capability delivery (from the plan)

| CAP | Phase | Files | Verification |
|---|---|---|---|
| CAP-ra-evolution-report | 2 | server/services/historyService.ts, shared/domain/compareDiagnoses.ts, shared/content/comparisonCopy.ts, src/features/history/ComparePage.tsx, server/report/evolutionDocument.ts, server/validation/reportSchemas.ts, server/services/reportService.ts, src/features/reports/ReportOptions.tsx, tests/unit/evolutionDocument.test.ts, tests/fixtures/rulesV2.ts, tests/e2e/report.spec.ts, tests/unit/forbiddenTerms.test.ts | pnpm exec vitest run tests/unit/evolutionDocument.test.ts tests/unit/forbiddenTerms.test.ts tests/api/historyRoutes.test.ts` + `pnpm exec playwright test tests/e2e/report.spec.ts tests/e2e/history.spec.ts |

## Implementation delta (from the plan)

| CAP | Action | Exact paths | Required change |
|---|---|---|---|
| CAP-ra-evolution-report | modify | server/services/historyService.ts | comparePair(fromId, toId)` com o mesmo `compareDiagnoses`; recusa empresa diferente, arquivado ou ordem invertida |
| CAP-ra-evolution-report | reuse | shared/domain/compareDiagnoses.ts | Sem mudança (F9) |
| CAP-ra-evolution-report | create | shared/content/comparisonCopy.ts | O aviso como função, para a tela e o PDF |
| CAP-ra-evolution-report | modify | src/features/history/ComparePage.tsx | Usa o texto compartilhado |
| CAP-ra-evolution-report | create | server/report/evolutionDocument.ts | Capa, "Antes e depois", "O que foi feito no período" (só com andamento ou diário), "Como ler" |
| CAP-ra-evolution-report | create | server/validation/reportSchemas.ts | Seleção `evolution` com `fromId` e `toId |
| CAP-ra-evolution-report | modify | server/services/reportService.ts | Seleção de evolução; nome `{empresa}-evolucao-{de}-a-{ate}.pdf |
| CAP-ra-evolution-report | create | src/features/reports/ReportOptions.tsx | "De" e "Até"; "Até" só posteriores e ajustado ao trocar "De" |
| CAP-ra-evolution-report | create | tests/unit/evolutionDocument.test.ts | Mesmo par = mesmos números da comparação, com recálculo |
| CAP-ra-evolution-report | reuse | tests/fixtures/rulesV2.ts | Sem mudança |
| CAP-ra-evolution-report | modify | tests/e2e/report.spec.ts | Escolha do par e AC-ra-14 |
| CAP-ra-evolution-report | modify | tests/unit/forbiddenTerms.test.ts | Inclui o PDF de evolução |

## Plan section for this phase (from the plan)

## Phase 2 — O PDF sai com a marca de quem entrega, e a central passa a gerar a evolução e a carteira

- CAP/AC:
  - CAP-ra-brand: AC-ra-20, AC-ra-21, AC-ra-22.
  - CAP-ra-evolution-report: AC-ra-12 (sem "O que foi feito no período" até as Fases 3 e 4), AC-ra-13, AC-ra-14.
  - CAP-ra-portfolio-report: AC-ra-15 (sem a coluna de ações vencidas até a Fase 3), AC-ra-16, e AC-ra-01 para "Relatório da carteira".
  - AC-ra-11 nos três PDFs.
  - Nas telas desta fase: AC-ra-57, AC-ra-59 (remover logo e voltar para FitPulse), AC-ra-60.
  - Interações do protótipo: `brand-save`, `brand-logo-upload`, `brand-logo-remove`, `brand-reset`, `report-type-evolution`, `portfolio-report`.
- User-visible outcome:
  - Em Configurações → "Seus relatórios", o usuário salva nome, logo, telefone, e-mail e site. A prévia da capa muda, e os três PDFs saem com a marca na capa e no rodapé.
  - Uma logo SVG, um texto renomeado para .png ou um arquivo de 3 MB são recusados no campo, e nada muda.
  - Com 2 diagnósticos concluídos, "Evolução" mostra "Antes e depois" com os mesmos números da tela "Comparar".
  - No modo consultoria, "Relatório da carteira" na tela inicial gera `carteira-{data}.pdf`.
- Implementation, nesta ordem:
  1. **Marca no servidor:** `brandSchemas`, `imageSignature`, `brandService`, `brandRoutes` (com parser próprio montado antes do `express.json`) e `preferenceRepository.readKeys`.
     - O `preferenceService` deixa de ler a logo.
     - `documentParts` e `pdfRenderer` desenham nome, logo e contato.
  2. **Marca na tela:** `phone.ts`, `contact.ts`, `PhoneField`, `brandApi`, `brandLogoImage` (confere os bytes, reduz para 600 px no mesmo formato), `BrandSection` em `SettingsPage` e a capa da prévia em `ReportSheet`.
     - As confirmações usam `ConfirmDialog`.
     - O rótulo segue o modo de uso.
  3. **Evolução:**
     - `historyService.comparePair`, `comparisonCopy` (usado também por `ComparePage`) e `evolutionDocument`.
     - Seleção `evolution` em `reportSchemas` e `reportService`; "De"/"Até" em `ReportOptions`.
  4. **Carteira:**
     - `followUp.ts` com 90 dias fixos até a Fase 5.
     - `portfolioRepository` e `portfolioService` extraídos de `homeService`, sem mudar o IF-007.
     - `portfolioDocument`, `PortfolioReportPage` na rota `relatorios/carteira` e o botão em `ConsultantHome`.
- Create/modify/reuse/retire:
  - modify: server/repositories/preferenceRepository.ts, server/services/preferenceService.ts, server/app.ts, server/services/reportService.ts, server/report/pdfRenderer.ts, src/features/settings/SettingsPage.tsx, server/services/historyService.ts, src/features/history/ComparePage.tsx, tests/e2e/report.spec.ts, tests/unit/forbiddenTerms.test.ts, server/services/homeService.ts, src/features/home/ConsultantHome.tsx, src/App.tsx, tests/api/homeRoutes.test.ts.
  - create: server/validation/brandSchemas.ts, server/files/imageSignature.ts, server/services/brandService.ts, server/routes/brandRoutes.ts, server/report/documentParts.ts, shared/format/phone.ts, shared/format/contact.ts, src/components/form/PhoneField.tsx, src/api/brandApi.ts, src/features/settings/brandLogoImage.ts, src/features/settings/BrandSection.tsx, src/features/reports/ReportSheet.tsx, tests/unit/imageSignature.test.ts, tests/unit/contactFormat.test.ts, tests/api/brandRoutes.test.ts, tests/unit/pdfRenderer.test.ts, tests/e2e/brand.spec.ts, shared/content/comparisonCopy.ts, server/report/evolutionDocument.ts, server/validation/reportSchemas.ts, src/features/reports/ReportOptions.tsx, tests/unit/evolutionDocument.test.ts, shared/domain/followUp.ts, server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, server/report/portfolioDocument.ts, src/features/reports/PortfolioReportPage.tsx, tests/unit/followUp.test.ts, tests/unit/portfolioDocument.test.ts, tests/e2e/portfolioReport.spec.ts.
  - reuse: src/components/feedback/ConfirmDialog.tsx, shared/domain/compareDiagnoses.ts, tests/fixtures/rulesV2.ts.
- Verification:
  - `pnpm build`.
  - `pnpm exec vitest run tests/unit/imageSignature.test.ts tests/unit/contactFormat.test.ts tests/api/brandRoutes.test.ts tests/api/preferenceRoutes.test.ts tests/unit/pdfRenderer.test.ts tests/unit/evolutionDocument.test.ts tests/unit/followUp.test.ts tests/unit/portfolioDocument.test.ts tests/unit/forbiddenTerms.test.ts tests/api/historyRoutes.test.ts tests/api/homeRoutes.test.ts`.
  - `pnpm exec playwright test tests/e2e/brand.spec.ts tests/e2e/report.spec.ts tests/e2e/portfolioReport.spec.ts tests/e2e/history.spec.ts tests/e2e/home.spec.ts`.
  - No dev-link do Play: salvar uma logo PNG e outra JPG, exportar os três PDFs e conferir a capa e o rodapé.
- Done when:
  - Os três PDFs saem com a marca configurada, e com a marca FitPulse quando ela fica em branco.
  - Evolução e carteira exportam e abrem pelo mesmo estado de entrega.
  - A tela do consultor mostra os mesmos números de antes.

## Context contract

- Plan: .aioson/context/implementation-plan-relatorios-e-acompanhamento.md — your phase section and table rows are embedded above; open the whole plan only for a cross-reference.
- PRD: .aioson/context/prd-relatorios-e-acompanhamento.md — the acceptance criteria of your capabilities are embedded above; open it only for a business rule they cite.
- Rules: run `aioson context:brief . --agent=dev --mode=executing --paths=server/services/historyService.ts,shared/domain/compareDiagnoses.ts,shared/content/comparisonCopy.ts,server/report/evolutionDocument.ts,server/validation/reportSchemas.ts,server/services/reportService.ts,tests/unit/evolutionDocument.test.ts,tests/fixtures/rulesV2.ts --task="unit phase-2-backend-evolution of relatorios-e-acompanhamento"` and load only what it selects (`must_load` is binding); never read `.aioson/rules/` wholesale.
- Everything else (other phases, other lanes, the briefing) is out of your context on purpose: what you need from another unit arrives as messages appended below, and what another unit needs from you goes into `messages[]` of your report.
