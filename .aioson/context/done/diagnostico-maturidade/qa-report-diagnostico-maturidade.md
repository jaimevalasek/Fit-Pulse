---
feature: diagnostico-maturidade
verdict: pass
verified_at: 2026-10-25T01:55:00.000Z
production_entry: "pnpm start (prepare-app --migrate + tsx server/main.ts + vite preview) com PORT/BACKEND_PORT injetadas → http://127.0.0.1:{PORT}/"
---

# QA report — diagnostico-maturidade (FitPulse v1)

## Verdict and blocking findings

**Verdict: PASS.** Os 12 CAPs obrigatórios e os 51 ACs têm evidência concreta. A evidência vem de quatro roteiros executados no app real, nesta revisão: 308/308 passos, iniciados por `pnpm start` com banco e pasta pessoal descartáveis. Somam-se a ela a suíte completa (757 testes de unidade e de API, 52 e2e), os três smokes de execução e a instalação limpa pelo pacote da loja.

Achados bloqueantes: **nenhum**.

Achados não bloqueantes (registrados, fora das promessas dos ACs):

| ID | Severidade | Achado | Evidência | Rota |
|---|---|---|---|---|
| QA-dm-01 | Baixa (texto) | A página 2 do PDF diz "O estágio da empresa fica limitado pela dimensão mais fraca". Isso contradiz a RULE-dm-04 e a RULE-dm-06: o estágio vem dos critérios da RULE-dm-04, não da dimensão mais fraca. No roteiro, o PDF mostra "Estágio 3 de 4 · Escala" e, logo abaixo, "Retenção 56 · sustentaria o estágio 2", o que confunde quem lê. A frase não está no protótipo aprovado nem no PRD | `server/report/pdfRenderer.ts:248`; texto extraído de `Oficina Ponto Certo-2026-10-24.pdf` | Observação registrada. O PDF é refeito pela feature `relatorios-e-acompanhamento`, que já tem a página "Como ler": o @product deve carregar a correção para lá |
| QA-dm-02 | Conselho (MED) | `createBackupService` tem 95 linhas lógicas (o limite é 60) | `aioson rules:check . --changed` → `server/services/backupService.ts:82` | Conselho de manutenção, sem impacto no comportamento |
| QA-dm-03 | Conselho (MED) | `ResultPage.tsx` importa 17 módulos internos (o limite é 15) | `aioson rules:check . --changed` → `src/features/result/ResultPage.tsx:1` | Conselho de manutenção. A próxima feature mexe nessa tela |
| QA-dm-04 | Processo | A evidência visual do protótipo (medida em 22/10 às 18:51) está marcada como desatualizada porque o manifesto foi salvo de novo às 18:56 do mesmo dia | `feature:trace` → `visual.stale_files` | `prototype:check --strict` passa (22/22). O vínculo segue válido; a evidência visual não foi refeita |

## CAP/AC evidence table

Roteiros (relatórios em `.aioson/context/features/diagnostico-maturidade/browser/`): **W1** `qa-journey-owner` 139/139 · **W2** `qa-journey-history-settings` 77/77 · **W3** `qa-journey-companies` 74/74 · **W4** `qa-mobile-390` 18/18. Os números `#n` são os passos de cada roteiro.

| CAP | AC | Result | Evidence |
|---|---|---|---|
| CAP-dm-first-run | AC-dm-01 | PASS | W1 #0–#2: instalação nova abre direto em "Vamos descobrir em que degrau a sua empresa está", sem senha, porta ou banco; e2e `firstRun.spec.ts` "a new installation opens straight on the wizard" |
| CAP-dm-first-run | AC-dm-02 | PASS | W1 #4–#12: "Para a minha empresa" + nome, segmento e canal → `POST /api/companies` 201 → bloco "Seus números" do rascunho novo; e2e `firstRun.spec.ts` confere o modo owner e a empresa em foco |
| CAP-dm-first-run | AC-dm-03 | PASS | W1 #128–#136: o tour aparece na primeira abertura ("1 de 5"), "Pular" fecha e o "?" reabre; e2e `firstRun.spec.ts` (5 passos no modo empresa, 4 no modo consultoria) |
| CAP-dm-company | AC-dm-04 | PASS | W3 #2–#3 e #19–#21: "Nova empresa" → cadastro → página da empresa com "CNPJ 11.222.333/0001-81"; W1 #7: os obrigatórios são validados; e2e `companies.spec.ts` "starts empty, validates the required fields" |
| CAP-dm-company | AC-dm-05 | PASS | W3 #23–#31: "Editar dados" vem preenchido → `PATCH /api/companies/:id` → título "Studio Bela Vista" e a lista com o novo nome, sem alterar a outra empresa |
| CAP-dm-company | AC-dm-06 | PASS | W3 #37–#50: confirmação "Arquivar Studio Bela Vista?" → `POST …/archive` → a empresa sai das ativas; "Ver arquivadas" → "Restaurar" → `POST …/restore` → ela volta |
| CAP-dm-company | AC-dm-07 | PASS | W3 #45, #51–#73: "Excluir" só aparece na arquivada; o diálogo diz "A empresa e 2 diagnósticos serão apagados"; "Cancelar" mantém tudo (confirmado pela API); "Excluir definitivamente" → `DELETE /api/companies/:id` |
| CAP-dm-company | AC-dm-08 | PASS | W3 #7–#12: `inputmode=numeric`, maxlength 18, máscara "11.222.333/0001-80", mensagem "CNPJ inválido. Formato: 00.000.000/0000-00." ao sair do campo, `aria-invalid=true`; `tests/unit/cnpj.test.ts` |
| CAP-dm-company | AC-dm-09 | PASS | W3 #32–#35 e #43: busca sem resultado → "Nenhuma empresa encontrada" → "Limpar filtros"; alternância entre ativas e arquivadas; filtros Todos e Estágio 1 a 4 (snapshot #36); e2e `companies.spec.ts` |
| CAP-dm-questionnaire | AC-dm-10 | PASS | W1 #13 (8 blocos no trilho), cabeçalho de cada bloco de 1 a 8 e 24 perguntas respondidas mais 6 campos da calculadora; `tests/unit/questionBank.test.ts` |
| CAP-dm-questionnaire | AC-dm-11 | PASS | W1 #97–#98: o "?" alterna `aria-expanded`; e2e `questionnaire.spec.ts` "offers 'não sei' only on the questions about facts" |
| CAP-dm-questionnaire | AC-dm-12 | PASS | W1: 29 respostas, cada uma com `PATCH /api/diagnoses/:id` 200 comprovado; recarregar no bloco 3 mantém pc1=3 e "Salvo automaticamente às 22:48" |
| CAP-dm-questionnaire | AC-dm-13 | PASS | W2 #6–#13: "Novo diagnóstico" → `POST /api/companies/:id/diagnoses` → rascunho já preenchido (mp1=3); depois o botão vira "Continuar diagnóstico" e não aparece outro "Novo diagnóstico" |
| CAP-dm-questionnaire | AC-dm-14 | PASS | W1 #99–#105: abre o portão em ouro "Concluir o diagnóstico?"; Esc cancela e mantém o rascunho; "Concluir e ver resultado" conclui; e2e `questionnaire.spec.ts` "lists the pending blocks" (`role=alert` com links) |
| CAP-dm-unit-economics | AC-dm-15 | PASS | W1 #15–#28: "R$ 2.000,00", total "R$ 3.540,00", "R$ 48,00"; o painel recalcula "R$ 60,00" e "Saudável"; `tests/unit/money.test.ts`, `unitEconomics.test.ts`; e2e `calculator.spec.ts` (estimado por faixa) |
| CAP-dm-questionnaire | AC-dm-16 | PASS | W2 #15–#24: "Descartar o rascunho de dd/mm/aaaa?"; Cancelar não muda nada; confirmar → `DELETE /api/diagnoses/:id`; o diagnóstico concluído continua na linha do tempo |
| CAP-dm-questionnaire | AC-dm-17 | PASS | W3 #13–#19: corrigir o CNPJ apaga o erro, e o clique logo em seguida em "Cadastrar empresa" envia (`POST /api/companies` 201) |
| CAP-dm-engine | AC-dm-18 | PASS | `tests/unit/diagnosisRules.test.ts` "computeDimensionScores (RULE-dm-01, RULE-dm-02, AC-dm-18)"; `evaluateDiagnosis.test.ts` com os casos G1 a G4 |
| CAP-dm-engine | AC-dm-19 | PASS | W1 #113 "Sustentaria o estágio"; `diagnosisRules.test.ts` "the stage a dimension would sustain" e "the warning starts below 50" |
| CAP-dm-engine | AC-dm-20 | PASS | `diagnosisRules.test.ts` "computeStageAndLock: reference cases" e "edge table" (inclui custo estimado bloqueando o estágio 3) |
| CAP-dm-engine | AC-dm-21 | PASS | `diagnosisRules.test.ts` "unknown spend or new customers"; e2e `result.spec.ts` "puts an unmeasured cost in stage 1 with the high risk of score 16" |
| CAP-dm-engine | AC-dm-22 | PASS | W1 #118–#119: o resultado continua igual depois de recarregar; `tests/api/diagnosisRoutes.test.ts` (versão das regras gravada na conclusão); e2e `history.spec.ts` com `tests/fixtures/rulesV2.ts` |
| CAP-dm-engine | AC-dm-23 | PASS | W1 #115: cada risco tem "Probabilidade P de 5", "Impacto I de 5" e "Como reduzir:"; o PDF mostra "Depender de um só canal · Médio · 12"; `diagnosisRules.test.ts` "detectRisks" |
| CAP-dm-engine | AC-dm-24 | PASS | `diagnosisRules.test.ts` "finds no risk when no signal fires"; e2e `result.spec.ts` "shows the no-risk state" |
| CAP-dm-engine | AC-dm-25 | PASS | W1 #110 (3 ações); `evaluateDiagnosis.test.ts` "builds the exact three-action plan" com G1 a G4 e "gives different plans to two companies at the same stage" |
| CAP-dm-engine | AC-dm-26 | PASS | `evaluateDiagnosis.test.ts` "the invest action needs a measured cost and high confidence" (6 casos); W1: com custo medido e confiança alta, a ação "Aumentar aos poucos o investimento" aparece no estágio 3 |
| CAP-dm-engine | AC-dm-27 | PASS | W1 #105–#106: `POST /api/diagnoses/:id/complete` 200 e resultado visível dentro do limite de 3000 ms do passo; e2e `result.spec.ts` "within 3 seconds" |
| CAP-dm-result | AC-dm-28 | PASS | W1 #107–#112: `aria-label` "Estágio 3 de 4: Escala. Trava para subir: transformar mais orçamentos em venda.", trava em itálico, 3 ações, aviso de orientação e ordem escada → trava → ações → aviso → encaixes → frentes → números → riscos → confiança |
| CAP-dm-result | AC-dm-29 | PASS | W1 #116: nenhum termo proibido na tela; texto do PDF extraído sem termos proibidos; `tests/unit/forbiddenTerms.test.ts` |
| CAP-dm-history | AC-dm-30 | PASS | W2 #3–#5: linha do tempo com "Concluído · Estágio 3 · Escala · Cálculo 1 · confiança alta" e sem comparação no primeiro diagnóstico; #46–#52: arquivar pede confirmação, Esc cancela, `POST …/archive` → "Diagnósticos arquivados (1)" |
| CAP-dm-history | AC-dm-31 | PASS | W2 #37–#43: "Comparar" → `GET /api/diagnoses/:id/comparison` → "Escala → Escala", "Média das 8 dimensões: 86 → 92" e tabela com a mudança em texto; e2e `history.spec.ts` (aviso de versão diferente) |
| CAP-dm-home | AC-dm-32 | PASS | W1 #127 e #132–#134: no modo empresa, escada, trava e data do último diagnóstico; e2e `home.spec.ts` "owner mode shows the focus company's ladder, lock, 3 actions, draft and evolution" |
| CAP-dm-home | AC-dm-33 | PASS | e2e `home.spec.ts` "owner indicators follow the data: a draft, a new conclusion and an archive"; `tests/api/homeRoutes.test.ts` |
| CAP-dm-home | AC-dm-34 | PASS | W2 #65: carteira por estágio "1 em Escala" e as listas de rascunhos parados, sem diagnóstico recente e com risco alto (snapshot #67); e2e `home.spec.ts` "leads each list to the right companies" |
| CAP-dm-home | AC-dm-35 | PASS | W3 #22: "Começar o primeiro diagnóstico" numa empresa sem diagnóstico; e2e `home.spec.ts` "consultant mode without companies offers the first one" |
| CAP-dm-report | AC-dm-36 | PASS | W1 #120–#126: "Salvar PDF" → `POST /api/diagnoses/:id/report` 200 → "PDF salvo em …\Downloads: Oficina Ponto Certo-2026-10-24.pdf" com o resultado ainda aberto. O arquivo tem 3 páginas, com empresa, data 24/10/2026, versão 1, confiança, estágio, trava, 8 dimensões, riscos, 3 ações e aviso; e2e `report.spec.ts` cobre cancelar e falha de gravação |
| CAP-dm-backup | AC-dm-37 | PASS | W2 #73–#75: "Exportar meus dados" → `POST /api/backup/export` → "Cópia salva … com 1 empresa e 2 diagnósticos"; importar um arquivo inválido é recusado (4xx) e a quantidade de empresas não muda; e2e `backup.spec.ts` (3 testes) |
| CAP-dm-settings | AC-dm-38 | PASS | W2 #56–#63: "Claro" → `PUT /api/preferences` → o tema muda na hora e continua depois de recarregar; "Consultoria" troca a tela inicial; e2e `settings.spec.ts` |
| CAP-dm-settings | AC-dm-39 | PASS | W2 #61–#62: "Como ler os resultados" (versão do cálculo) e a lista exata do que o assistente do Play lê |
| CAP-dm-play-runtime | AC-dm-40 | PASS | W1 #2 (nenhum campo de senha); `manifest.json` lido: sem `requires_services` e sem `auth`; e2e `shell.spec.ts` |
| CAP-dm-play-runtime | AC-dm-41 | PASS | W2 #68: `GET /api/aioson-play` lista `/api/assistant/summary`; `tests/api/playRoutes.test.ts` |
| CAP-dm-play-runtime | AC-dm-42 | PASS | W2 #69–#70: o resumo traz "Oficina Ponto Certo" e nenhum `R$`, centavos, respostas ou calculadora; `playRoutes.test.ts` |
| CAP-dm-play-runtime | AC-dm-43 | PASS | `manifest.json` lido: name FitPulse, `stack: split`, processes com `port_env` PORT/BACKEND_PORT, `webview_target: frontend`, `has_api: true`, `compatibility.schema_version: 1`; W1 #3 (sem "V-Stage") |
| CAP-dm-play-runtime | AC-dm-44 | PASS | `node scripts/smoke-boot.mjs` PASS: o app responde nas portas injetadas e as duas portas recusam conexão nos 3 IPv4 externos; `playRoutes.test.ts` (Host estranho → 403) |
| CAP-dm-play-runtime | AC-dm-45 | PASS | `node scripts/smoke-migrate.mjs` PASS (5/5); `node scripts/smoke-store-package.mjs` PASS (8/8): pacote de 137 arquivos sem `data/`, banco ou lockfile, e dados idênticos depois de uma atualização com mudança de esquema |
| CAP-dm-home | AC-dm-46 | PASS | W4 18/18: sem rolagem horizontal a 390 px em início, empresas, configurações, empresa e resultado; e2e `accessibility.spec.ts` "every route at 390 px" com axe nos temas escuro e claro |
| CAP-dm-company | AC-dm-46 | PASS | W4: empresas e página da empresa a 390 px sem rolagem horizontal; e2e `companies.spec.ts` "fits 390 px and passes axe on the list and on the form" |
| CAP-dm-questionnaire | AC-dm-46 | PASS | e2e `questionnaire.spec.ts` "fits 390 px and passes axe on the calculator and on a question block"; `accessibility.spec.ts` nos dois temas |
| CAP-dm-result | AC-dm-46 | PASS | W4 (resultado a 390 px sem rolagem horizontal, captura `result-390`); e2e `result.spec.ts` "fits 390 px and passes axe" |
| CAP-dm-settings | AC-dm-46 | PASS | W4 (configurações a 390 px sem rolagem horizontal); e2e `accessibility.spec.ts` "every route at 390 px" nos temas escuro e claro |
| CAP-dm-home | AC-dm-47 | PASS | e2e `home.spec.ts` "both home screens show their final state with reduced motion, fit 390 px and pass axe" |
| CAP-dm-result | AC-dm-47 | PASS | e2e `result.spec.ts` "shows everything in its final state with reduced motion (AC-dm-47)" |
| CAP-dm-company | AC-dm-48 | PASS | W3 #38: "Arquivar Studio Bela Vista?" e "Excluir Oficina Ponto Certo?" com consequência, verbo e "Cancelar"; `rules:check` status-change-confirmation OK (nenhum diálogo nativo) |
| CAP-dm-questionnaire | AC-dm-48 | PASS | W1 #100–#103: "Concluir o diagnóstico?" fecha com Esc e o rascunho fica; W2 #16–#20: "Descartar o rascunho de …?", Cancelar e foco dentro do modal |
| CAP-dm-history | AC-dm-48 | PASS | W2 #47–#49: arquivar um diagnóstico abre o modal do app; Esc cancela; confirmar → `POST …/archive` |
| CAP-dm-engine | AC-dm-49 | PASS | W1 #114 "Confiança nos dados: alta"; `diagnosisRules.test.ts` "computeConfidence" (custo por faixa limita a "média") |
| CAP-dm-play-runtime | AC-dm-50 | PASS | e2e `shell.spec.ts` "renders Inter and JetBrains Mono from the bundled files, with the outside network cut"; a fixture do e2e reprova qualquer requisição fora de `127.0.0.1`/`localhost` nos 52 testes |
| CAP-dm-unit-economics | AC-dm-51 | PASS | W1 #29 e #117: nenhum "NaN" ou "Infinity" na calculadora e no resultado; e2e `calculator.spec.ts` "explains the cost it cannot calculate and reads a zero margin without NaN" |

## Commands executed and results

- `aioson preflight . --agent=qa --feature=diagnostico-maturidade`: Gates A, B e C aprovados; BLOCKED apenas porque este relatório ainda não existia
- `aioson prototype:check . --feature=diagnostico-maturidade --strict`: PASS (exit code 0), 22/22 interações, identidade current
- `aioson ac:test-audit . --feature=diagnostico-maturidade --strict`: PASS, 51/51 ACs cobertos, 0 fracos
- `aioson feature:trace . --feature=diagnostico-maturidade --json`: 24/24 PROM cobertos, 12 CAPs obrigatórios, 0 gaps
- `pnpm typecheck`: PASS (exit code 0)
- `pnpm test`: PASS (exit code 0), 17 arquivos, 757 testes
- `pnpm test:e2e`: PASS (exit code 0), 52/52 em 3,8 min
- `pnpm build`: PASS (exit code 0); aviso de pacote acima de 500 kB, sem impacto num app local
- `node scripts/smoke-migrate.mjs`: PASS (exit code 0)
- `node scripts/smoke-boot.mjs`: PASS (exit code 0)
- `node scripts/smoke-store-package.mjs`: PASS (exit code 0)
- `aioson rules:check . --changed`: RULES=OK (exit code 0); 2 conselhos MED (QA-dm-02, QA-dm-03)
- `aioson browser:run . --script=.aioson/qa/walkthroughs/diagnostico-maturidade/qa-journey-owner.json --slug=diagnostico-maturidade`: PASS 139/139
- `aioson browser:run . --script=.aioson/qa/walkthroughs/diagnostico-maturidade/qa-journey-history-settings.json --slug=diagnostico-maturidade`: PASS 77/77
- `aioson browser:run . --script=.aioson/qa/walkthroughs/diagnostico-maturidade/qa-journey-companies.json --slug=diagnostico-maturidade`: PASS 74/74
- `aioson browser:run . --script=.aioson/qa/walkthroughs/diagnostico-maturidade/qa-mobile-390.json --slug=diagnostico-maturidade`: PASS 18/18
- Extração de texto do PDF gerado (unpdf): 3 páginas com todos os campos da AC-dm-36

Os roteiros W1 a W4 rodam em sequência sobre o mesmo banco descartável: W2 parte do estado deixado por W1, e W3 e W4 do deixado por W2. Para reproduzir, suba `pnpm start` com um `DATABASE_URL` vazio na porta 5491 e rode os quatro na ordem.

## Production-path smoke

- Entry: `pnpm start` (o mesmo comando que o Play roda pela loja: `prepare-app --migrate` + `tsx server/main.ts` + `vite preview`) com PORT=5491, BACKEND_PORT=3491, `DATABASE_URL` e HOME descartáveis → `http://127.0.0.1:5491/`; relatório `.aioson/context/features/diagnostico-maturidade/browser/qa-journey-owner.json`
- Trigger: primeiro uso "Para a minha empresa" → cadastro → 6 campos da calculadora e 24 respostas → "Ver meu resultado" → "Concluir e ver resultado" → "Exportar PDF" → "Salvar PDF"
- Real boundary: `POST /api/companies` → 201; 29× `PATCH /api/diagnoses/:id` → 200; `POST /api/diagnoses/:id/complete` → 200; `POST /api/diagnoses/:id/report` → 200 (tráfego capturado no relatório W1)
- State change: o rascunho no SQLite sobreviveu ao recarregar a página (pc1=3, "Salvo automaticamente às 22:48"); o resultado concluído não mudou depois de recarregar; o arquivo `Oficina Ponto Certo-2026-10-24.pdf` (26 KB, 3 páginas) foi gravado em `Downloads`
- Visible result: "Estágio 3 de 4: Escala. Trava para subir: transformar mais orçamentos em venda.", 3 ações, "Orientação baseada nas suas respostas. Não substitui uma análise financeira." e "PDF salvo em …\Downloads: Oficina Ponto Certo-2026-10-24.pdf"

## Prototype fidelity and approved deviations

- Telas, estados e interações do protótipo aprovado: `prototype:check --strict` 22/22, e os roteiros percorreram assistente, tela inicial nos dois modos, empresas, página da empresa, questionário com calculadora, resultado em camadas, comparação e configurações.
- Desvio 1 (24 perguntas do Conteúdo metodológico v1): W1 respondeu 24 perguntas mais 6 campos da calculadora; `questionBank.test.ts`.
- Desvio 2 (regras do PRD): testes de unidade do motor com G1 a G4 e com a tabela de casos de borda.
- Desvio 3 (arquivos reais): PDF gravado e lido (W1); cópia gravada em Downloads (W2).
- Desvio 4 (sem faixa, seção ou empresas de demonstração): o snapshot das Configurações não tem a seção "Demonstração"; a instalação começa vazia (W1 #0).
- Desvio 5 (cursor preservado nas máscaras): `tests/unit/cnpj.test.ts` "maskCnpjInput caret handling (deviation 5)" e `money.test.ts`.
- A linha "O que mais trava agora: {dimensão mais fraca}" ao lado da frase da trava vem do protótipo aprovado e está fiel. Já a frase do PDF citada em QA-dm-01 não vem dele.

## Prototype binding resolution

- current — `diagnostico-maturidade` → `.aioson/briefings/diagnostico-maturidade/prototype.html` (manifesto `.aioson/briefings/diagnostico-maturidade/prototype-manifest.md`, aprovado em 22/10/2026). Identidade: `.aioson/briefings/diagnostico-maturidade/identity.md`.
- Referência histórica excluída: `.aioson/briefings/relatorios-e-acompanhamento/prototype.html` → feature `relatorios-e-acompanhamento` (briefing aprovado, em planejamento). Não foi usada como autoridade desta entrega.

## Engineering-control evidence and recovery result

| Concern | Result | Evidence |
|---|---|---|
| dependency risk | PASS | `smoke-store-package.mjs`: `pnpm install` sem lockfile a partir do pacote real; binário do better-sqlite3 presente |
| compatibility | PASS | `smoke-store-package.mjs`: publicação em modo fonte; o `postinstall` refaz `dist/` com as fontes |
| data/schema and recovery | PASS | `smoke-migrate.mjs` 5/5 e a simulação de update no `smoke-store-package.mjs`: dados idênticos e deploy repetido sem efeito |
| authorization | PASS | `smoke-boot.mjs`: portas recusam conexão de fora; `playRoutes.test.ts`: Host estranho → 403, `text/plain` → 415 |
| validation | PASS | Casos negativos das suítes de API (757 testes); W3: CNPJ inválido recusado no campo |
| upload | PASS | W2 #75: importação inválida → 4xx sem mudar nada; `backupRoutes.test.ts` (transação desfeita) |
| concurrency/idempotency | PASS | `diagnosisRoutes.test.ts` (inícios e conclusões em paralelo); W2 #13: nada de segundo rascunho |
| file writes | PASS | W1: nome `{empresa}-{data}.pdf` em Downloads; `reportRoutes.test.ts` com nomes hostis e falha de gravação; e2e `report.spec.ts` "a failed write shows the error … changes nothing" |
| accessibility/localization | PASS | e2e `accessibility.spec.ts` (390 px + axe nos dois temas); W4; R$ e datas pt-BR em W1 |
| external requests | PASS | Fixture do e2e que reprova requisições externas nos 52 testes; `shell.spec.ts` com a rede externa cortada |

Recuperação: a importação que falhou não mudou nada (W2 #75); a falha de gravação do PDF não alterou o resultado (e2e); e o update da loja preservou os dados (`smoke-store-package.mjs`).

## Regression/security notes

- Regressão: suíte completa verde (757 de unidade e de API, 52 e2e) e typecheck e build limpos.
- Segurança: sem login por decisão (RULE-dm-16). O app escuta só em 127.0.0.1, guarda o Host e exige JSON nas escritas; nenhum CORS. O assistente do Play não recebe valores em reais nem respostas (W2 #69). Não existe `security-findings-diagnostico-maturidade.json`, então não há achado de @pentester a julgar.
- Os dados do dono não foram tocados: todo o roteiro rodou num banco e numa pasta Downloads descartáveis, fora do projeto.
