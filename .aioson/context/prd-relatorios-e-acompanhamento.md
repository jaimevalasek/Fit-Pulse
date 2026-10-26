---
feature: relatorios-e-acompanhamento
classification: MEDIUM
feature_completeness: required
product_scope: approved
prd_ready: approved
sheldon_review: approved
prototype: .aioson/briefings/relatorios-e-acompanhamento/prototype.html
prototype_status: current
prototype_feature: relatorios-e-acompanhamento
identity: .aioson/briefings/relatorios-e-acompanhamento/identity.md
identity_status: current
---

# PRD — FitPulse: relatórios profissionais e acompanhamento entre diagnósticos

## Vision

Hoje o FitPulse só serve no dia do diagnóstico. Esta versão o transforma em ferramenta de acompanhamento em dois movimentos.

**Relatórios que se explicam sozinhos.** O dono ou o consultor encontra os relatórios a um clique, na página da empresa, no resultado e na tela inicial. Ao montar o relatório, vê a folha do PDF mudar na hora. O arquivo sai com a marca de quem entrega e abre com "Abrir PDF" logo depois de salvo. São três relatórios:
- o diagnóstico, com capa, resumo de uma página, gráfico, matriz de riscos e "Como ler";
- a evolução entre dois diagnósticos;
- a carteira de empresas do consultor.

**A vida entre um diagnóstico e o próximo.**
- **Ações:** cada uma das 3 ações do plano ganha estado, prazo, responsável por papel e nota.
- **Lembrete na tela inicial:** conta os dias até refazer o diagnóstico e aponta as ações vencidas.
- **Diário de números:** o diário mensal de gasto e clientes novos faz o próximo diagnóstico chegar com o custo por cliente **medido**, não "não calculado".
- **Questionário à distância:** o consultor manda ao cliente um questionário que ele responde sozinho no computador. As respostas voltam como rascunho para revisar e concluir.

Tudo continua no computador de quem usa, sem login, sem servidor externo e sem dados de terceiros.

## Problem and users

**Problema.** A versão 1 (`diagnostico-maturidade`, entregue e fechada em 25/10/2026) cumpre o diagnóstico, mas para no dia em que ele termina:
- **O PDF se esconde.** O botão fica só no resultado e o arquivo some na pasta Downloads. O documento é uma lista de texto sem capa, resumo, gráfico nem a marca de quem entrega (SRC-001 §3.1).
- **As ações não têm acompanhamento.** As 3 ações não têm prazo nem estado, e nada lembra de refazer o diagnóstico.
- **Os números continuam faltando.** O custo por cliente aparece "não calculado" para quem não sabe o gasto, e o app não tem onde anotar.
- **O próximo diagnóstico repete a trava**, e o método perde credibilidade.
- **O consultor não tem o que precisa:** relatório com a marca dele, visão da carteira em PDF e uma forma de o cliente responder sem a presença dele.

Sem isso, o FitPulse fica igual aos diagnósticos de disparo único que a versão 1 quis superar (SRC-002 §1.4).

**Usuários.**

| Usuário | Situação | Progresso desejado | Contorno atual |
|---|---|---|---|
| Dono de pequena empresa (primário) | Terminou o diagnóstico e vai mostrar o resultado a sócio, contador ou banco; depois precisa executar as 3 ações e voltar em 3 meses | Um documento sério que se explica sozinho; lembrar o que combinou; chegar ao próximo diagnóstico com números medidos | Mostrar a tela do app; anotar as ações num caderno; responder "não sei" de novo |
| Consultor que atende várias empresas (secundário) | Entrega o diagnóstico ao cliente e precisa justificar o trabalho na visita seguinte; o cliente às vezes está longe | Relatório com a própria marca, evolução desde a última visita, carteira em PDF e um questionário que o cliente responde sozinho | PDF com a marca FitPulse; preencher o questionário junto com o cliente; planilha própria da carteira |

**Fora do público:** equipes com vários operadores na mesma instalação. Continua sem login nem papéis (RULE-dm-16 da versão 1).

## Feature Capability Map

Fatias de entrega (decisão F10, um PRD executado em 3 partes, cada parte utilizável sozinha):
- **parte 1:** relatórios, marca e acabamento;
- **parte 2:** ações, lembrete e diário;
- **parte 3:** questionário à distância.

`CAP-ra-data-continuity` acompanha as três partes.

| CAP | Promised outcome | Actor / trigger | Scope decision | Rationale |
|---|---|---|---|---|
| CAP-ra-report-center | O usuário encontra os relatórios a 1 clique e monta o relatório: escolhe o tipo, o diagnóstico ou o par e as opções. A folha paginada do PDF muda na hora | Dono ou consultor, pelo botão "Relatórios" na empresa, no resultado e na tela inicial | required | PROM-001 e PROM-004; assinatura do protótipo aprovado ("a folha montada ao vivo"). Parte 1 |
| CAP-ra-diagnosis-report | O PDF do diagnóstico ganha capa, resumo executivo de 1 página, barras agrupadas, matriz 5×5, números explicados, andamento das ações, "Como ler" e, só se o usuário marcar, as respostas | Usuário exporta um diagnóstico concluído | required | PROM-002 e PROM-004; F11 (respostas desligadas por padrão, barras). Parte 1 |
| CAP-ra-evolution-report | Com 2 diagnósticos concluídos da mesma empresa, um PDF mostra antes e depois, o que foi feito no período e o custo por cliente do diário | Usuário escolhe "Evolução" e o par | required | PROM-004; F9 (mesmo cálculo da comparação). Parte 1; ações e diário aparecem com a parte 2 |
| CAP-ra-portfolio-report | No modo consultoria, um PDF da carteira lista as empresas por estágio, com reavaliação atrasada, risco alto e ações vencidas | Consultor, pela tela inicial ou pela central | required | PROM-004; F10/F11 (ações vencidas com a parte 2; CSV fica para depois). Parte 1 |
| CAP-ra-pdf-delivery | O PDF salvo na pasta Downloads abre com "Abrir PDF" e aparece com "Mostrar na pasta". Uma falha de gravação não muda nada | Usuário depois de "Exportar PDF" | required | PROM-001 ("que o usuário encontre e use"); F6. Parte 1 |
| CAP-ra-brand | Em Configurações, o usuário põe nome, logo e o próprio contato. A capa e o rodapé dos PDFs passam a usá-los; tudo em branco significa FitPulse | Dono ou consultor, em Configurações → "Seus relatórios" | required | PROM-008; F2, F7, F8. Parte 1 |
| CAP-ra-polish | São corrigidos os defeitos vistos na inspeção e no QA da versão 1: plural de "itens", rótulos de risco que quebram, destaque do "Exportar PDF" e a frase errada sobre o estágio no PDF | Qualquer usuário no resultado e no PDF | required | PROM-002; briefing §6; observação OBS-9d1a49 do QA da versão 1. Parte 1 |
| CAP-ra-action-tracking | Cada ação do plano tem estado, prazo, responsável por papel e nota. As ações de um plano substituído ficam "encerradas" no histórico, e o resultado do diagnóstico nunca muda | Usuário na aba Ações, no resultado e na tela inicial | required | PROM-003 e PROM-005; F2 (papel, sem nome), F11 (só as 3 ações). Parte 2 |
| CAP-ra-action-inheritance | Ao concluir um diagnóstico novo, a ação que se repete herda o andamento e as que não se repetem ficam encerradas no anterior. Nada duplica nem se perde | Sistema, na conclusão de um diagnóstico | required | PROM-005; F3; R-11. Parte 2 |
| CAP-ra-home-followup | A tela inicial passa a mostrar "faltam N dias para refazer o diagnóstico" (dono), ações vencidas (dono e consultor) e questionários aguardando (consultor), cada indicador abrindo a lista certa. O intervalo de reavaliação é configurável | Dono ou consultor ao abrir o app | required | PROM-003 e PROM-005; F6 (aviso só dentro do app); regra `management-home-widgets`. Parte 2 (questionários aguardando: parte 3) |
| CAP-ra-diary | Por empresa, um registro por mês com o gasto nas 6 partes (ou só o total) e os clientes novos, mostrando o custo por cliente do mês, a tendência e quanto falta para o número ser medido | Dono, ou o consultor pelo cliente, na aba Diário | required | PROM-006; F5, F12. Parte 2 |
| CAP-ra-diary-prefill | Um diagnóstico novo chega com os números do diário: com 3 meses ou mais, eles contam como medidos; com 1 ou 2 meses, são uma sugestão estimada. O usuário vê a origem e pode corrigir antes de concluir | Sistema, ao criar o rascunho; usuário no bloco "Seus números" | required | PROM-003 e PROM-006; F4, F5; R-9. Parte 2 |
| CAP-ra-remote-questionnaire | O consultor gera um arquivo de questionário. O cliente o abre no navegador do computador, responde e salva um arquivo de respostas. O consultor importa esse arquivo, que vira um rascunho para revisar e concluir | Consultor na página da empresa; cliente no navegador do computador | required | PROM-007; F1 (forma B, só computador). Parte 3, depois do teste Q-10 |
| CAP-ra-data-continuity | A atualização pela loja mantém todos os dados. A cópia de segurança passa a levar a marca, as ações e o diário e continua aceitando as cópias da versão 1 | Sistema na atualização; usuário em "Exportar/Importar" | required | Impactos transversais do briefing; F7; R-10. Partes 1 a 3 |
| CAP-ra-diary-origin | Origem dos clientes por canal em cada mês do diário | Usuário no diário | deferred | Opcional no briefing (frente 4) e ausente do protótipo aprovado. Volta quando houver relatório por canal |
| CAP-ra-portfolio-csv | Exportar a carteira em planilha (CSV) | Consultor | deferred | F11 (Q-11): fica para depois |
| CAP-ra-custom-actions | Ações próprias além das 3 do plano | Usuário | deferred | F11 (Q-7): só as 3 ações, com nota livre |
| CAP-ra-diary-by-file | O arquivo do questionário à distância também leva e traz os meses do diário | Consultor e cliente | deferred | F12: no começo, o consultor digita; o envio pelo arquivo é extensão futura da forma B |
| CAP-ra-ai-plan | Plano de ação escrito por IA | Usuário | deferred | PROM-009: só depois da calibração das regras |
| CAP-ra-benchmark | Comparar com empresas do mesmo segmento | Usuário | not_applicable | PROM-010: exige nuvem; o app guarda tudo só no computador |

## Source Coverage

| Promise | Product decision | CAP / AC | Evidence / rationale |
|---|---|---|---|
| PROM-001 | required | CAP-ra-report-center, CAP-ra-pdf-delivery / AC-ra-01, AC-ra-02, AC-ra-17, AC-ra-18, AC-ra-61 | SRC-001 §1 "exportar relatórios em PDF" e §3.1 (o PDF existe, mas não é encontrado). O botão "Relatórios" em três lugares, "Abrir PDF" e o tour atacam a descoberta (F6) |
| PROM-002 | required | CAP-ra-diagnosis-report, CAP-ra-brand, CAP-ra-polish / AC-ra-05, AC-ra-06, AC-ra-07, AC-ra-22, AC-ra-23, AC-ra-24, AC-ra-25 | SRC-001 §1 "mais profissional": capa, resumo de 1 página, gráfico legível impresso, marca de quem entrega e acabamento |
| PROM-003 | required | CAP-ra-action-tracking, CAP-ra-home-followup, CAP-ra-diary-prefill / AC-ra-26, AC-ra-33, AC-ra-44 | SRC-001 §1 "mais eficaz": o diagnóstico só gera resultado se as ações forem acompanhadas e o próximo chegar com número medido |
| PROM-004 | required | CAP-ra-diagnosis-report, CAP-ra-evolution-report, CAP-ra-portfolio-report, CAP-ra-pdf-delivery / AC-ra-05, AC-ra-12, AC-ra-13, AC-ra-15, AC-ra-17 | SRC-001 §2 "Relatórios completos": três relatórios mais abrir depois de salvar. Decisões F6, F9 e F11 |
| PROM-005 | required | CAP-ra-action-tracking, CAP-ra-action-inheritance, CAP-ra-home-followup / AC-ra-26, AC-ra-27, AC-ra-28, AC-ra-31, AC-ra-33, AC-ra-34 | SRC-001 §2 "Acompanhar as ações": estado, prazo, responsável (por papel, F2) e lembrete de 90 dias (configurável) |
| PROM-006 | required | CAP-ra-diary, CAP-ra-diary-prefill / AC-ra-38, AC-ra-41, AC-ra-44, AC-ra-45 | SRC-001 §2 "Diário de números": anotar gasto e clientes novos por mês; o app calcula o custo por cliente. Decisões F4, F5 e F12 |
| PROM-007 | required | CAP-ra-remote-questionnaire / AC-ra-48, AC-ra-49, AC-ra-50, AC-ra-51, AC-ra-52 | SRC-001 §2 "Questionário à distância"; F1 (forma B, navegador do computador); antes, o teste Q-10 |
| PROM-008 | required | CAP-ra-brand / AC-ra-20, AC-ra-21, AC-ra-22 | SRC-001 §2 "Quem entrega o PDF": nome, logo e contato; em branco significa FitPulse. Decisões F2, F7 e F8 |
| PROM-009 | deferred | CAP-ra-ai-plan | O plano escrito por IA continua fora até a calibração das regras, como no PRD da versão 1 (CAP-dm-ai-plan) |
| PROM-010 | not_applicable | CAP-ra-benchmark | O benchmark entre empresas exige nuvem; o FitPulse guarda tudo só no computador do usuário |

**Decisões do refinamento (autoridade conferida).** O relatório `.aioson/briefings/relatorios-e-acompanhamento/refinement-report.md` está `applied` com `binding`. O arquivo `refinement-feedback.applied-round1.json` tem rodada 1, `source_hash` fd6133fa… e `applied_hash` fd0a1e85…, igual ao `briefings.md` atual. As 14 decisões estão aceitas, com seleção válida ou recomendação:

| Decisão | Seleção | Onde está neste PRD |
|---|---|---|
| F1 | `html-no-computador` | CAP-ra-remote-questionnaire; AC-ra-49; RULE-ra-11 |
| F2 | `contato-proprio-responsavel-papel` | RULE-ra-03, RULE-ra-04; AC-ra-20, AC-ra-28 |
| F3 | `herdar-repetidas` | CAP-ra-action-inheritance; RULE-ra-05; AC-ra-31, AC-ra-32 |
| F4 | `tres-meses` | RULE-ra-09; AC-ra-44, AC-ra-45 |
| F5 | recomendação (6 partes, "só sei o total", origem visível, corrigir antes de concluir) | RULE-ra-08, RULE-ra-09; AC-ra-38, AC-ra-44, AC-ra-46 |
| F6 | recomendação (Downloads + "Abrir PDF" e "Mostrar na pasta"; lembrete só no app) | CAP-ra-pdf-delivery; AC-ra-17, AC-ra-18, AC-ra-33 |
| F7 | recomendação (PNG/JPG até 2 MB, reduzida a 600 px, na cópia de segurança) | RULE-ra-03; AC-ra-21, AC-ra-55 |
| F8 | recomendação (sem cor de destaque) | RULE-ra-03; AC-ra-22 |
| F9 | recomendação (evolução = cálculo da comparação; só com 2 concluídos) | RULE-ra-02; AC-ra-12, AC-ra-13 |
| F10 | `fatiar-tres` | Feature Capability Map (partes 1, 2 e 3); MVP scope |
| F11 | recomendação (respostas desligadas, barras, só 3 ações, CSV depois) | AC-ra-07, AC-ra-09; CAP-ra-custom-actions e CAP-ra-portfolio-csv deferred |
| F12 | `consultor-digita` | AC-ra-42; CAP-ra-diary-by-file deferred |
| F13 | recomendação (QA e fechamento da versão 1 antes do @product) | Cumprida: QA PASS e `feature:close` em 25/10/2026 (`.aioson/context/done/diagnostico-maturidade/qa-report-diagnostico-maturidade.md`) |
| F14 | `identity-references` | Visual identity; prototype contract |

## Current System Fit

| CAP | Existing behavior / evidence | Fit decision | Required product delta |
|---|---|---|---|
| CAP-ra-report-center | O PDF só sai do diálogo `src/features/result/ExportReportDialog.tsx`, aberto no resultado de um diagnóstico. `server/routes/reportRoutes.ts` tem uma rota só (`POST /api/diagnoses/:id/report`). `src/features/companies/CompanyPage.tsx` não tem abas nem relatórios | extend | Manter o "Exportar PDF" do resultado. Acrescentar a central de relatórios (aba "Relatórios" da empresa, botão no resultado e na tela inicial), com tipo, opções e a prévia paginada do mesmo conteúdo do PDF |
| CAP-ra-diagnosis-report | `server/report/reportModel.ts` monta o conteúdo e `server/report/pdfRenderer.ts` (pdfkit, fontes embutidas) desenha 3 páginas de texto e barras com a marca FitPulse fixa. O arquivo é salvo por `server/services/reportService.ts` | extend | Mesmo gerador e mesmas fontes. Novo conteúdo e nova ordem: capa, resumo de 1 página, barras agrupadas, matriz 5×5, números explicados, andamento das ações, "Como ler" e respostas opcionais |
| CAP-ra-evolution-report | `shared/domain/compareDiagnoses.ts` e `server/services/historyService.ts` (comparação com recálculo quando as regras diferem, RULE-dm-11) alimentam `src/features/history/ComparePage.tsx`. Não existe PDF de evolução | extend | Um PDF novo que lê a mesma comparação, sem conta própria (F9) |
| CAP-ra-portfolio-report | `server/services/homeService.ts` monta a carteira por estágio e as listas de atenção (`OVERDUE_DIAGNOSIS_DAYS = 90`) para `src/features/home/ConsultantHome.tsx`. Não existe PDF da carteira | extend | Um PDF da carteira a partir dos mesmos dados da tela inicial; a reavaliação passa a seguir o intervalo configurado (RULE-ra-07) |
| CAP-ra-pdf-delivery | `server/files/downloadsFolder.ts` (`saveFile`: pasta Downloads fixa, nome saneado, sufixo " (2)", gravação em temporário + renomeação) devolve `{ fileName, directory }`. O diálogo mostra o aviso em texto. Nenhum código do servidor abre arquivo ou pasta no sistema | extend | Acrescentar "Abrir PDF" e "Mostrar na pasta", executados pelo backend só para arquivos que o próprio app salvou; manter a mensagem de onde salvou |
| CAP-ra-brand | `prisma/schema.prisma` guarda preferências em `Preference` (chave e valor em texto). `server/validation/preferenceSchemas.ts` aceita só `usageMode`, `theme` e a empresa em foco. `src/features/settings/SettingsPage.tsx` não tem marca. O PDF tem "FitPulse" fixo | extend | Nova seção "Seus relatórios" com nome, logo e contato próprio; a marca vai para a capa e o rodapé de todos os PDFs |
| CAP-ra-polish | `src/features/result/ConfidenceNote.tsx:15` usa "item" quando falta 1 item ("1 de 26 item sem o número"). Em `src/features/result/RiskList.tsx`, os rótulos de risco quebram em coluna estreita. O "Exportar PDF" de `src/features/result/ResultPage.tsx` tem pouco destaque. `server/report/pdfRenderer.ts:248` afirma "O estágio da empresa fica limitado pela dimensão mais fraca" (OBS-9d1a49) | extend | Corrigir o plural, a quebra dos rótulos, o destaque e o texto sobre o estágio |
| CAP-ra-action-tracking | `shared/domain/actionPlan.ts` (`buildActionPlan`) grava 3 `ActionKey` dentro do resultado imutável (RULE-dm-11). `src/features/result/ActionPlanList.tsx` só mostra. Nenhuma tabela guarda andamento | new | Um registro de andamento por ação de diagnóstico concluído, separado do resultado (R-3), com estado, prazo, papel e nota; lido na aba Ações, no resultado e na tela inicial |
| CAP-ra-action-inheritance | A conclusão em `server/services/diagnosisService.ts` grava resultado e plano novos sem olhar o plano anterior. O catálogo de ações tem chaves fixas (`ActionKey`, `shared/domain/types.ts`) | new | Na conclusão, comparar o plano novo com o do último concluído pela chave da ação e aplicar a RULE-ra-05 |
| CAP-ra-home-followup | `src/features/home/OwnerHome.tsx:154` mostra o texto fixo "Refazer a cada 3 meses…", sem contagem. `ConsultantHome.tsx` lista "Sem diagnóstico recente" com 90 dias fixos. Não há ações vencidas nem intervalo configurável | replace | Tela inicial do dono: o foco passa a ser "Refazer o diagnóstico" (layout do protótipo). Tela do consultor: entram ações vencidas e questionários aguardando, e a reavaliação usa o intervalo configurado. Configurações ganha o intervalo |
| CAP-ra-diary | O banco tem só `Company`, `Diagnosis` e `Preference` (`prisma/schema.prisma`). A calculadora já tem as 6 partes de gasto (`shared/content/calculatorOptions.ts`, `SPEND_PART_OPTIONS`) e a máscara de reais em centavos | new | Registro mensal por empresa, nas mesmas 6 partes ou só o total, com clientes novos; aba Diário com lista, gráfico, progresso e formulário |
| CAP-ra-diary-prefill | `diagnosisService.start` cria o rascunho copiando as respostas do último concluído (AC-dm-13). `shared/domain/unitEconomics.ts` marca o custo como medido só quando gasto e clientes novos são valores exatos e como estimado quando vêm de faixa. A calculadora pergunta os totais "nos últimos 3 meses" | extend | Ao criar o rascunho, os números da calculadora vêm do diário (RULE-ra-09), com a origem visível; o resto do comportamento da versão 1 continua |
| CAP-ra-remote-questionnaire | Não existe troca de respostas por arquivo (CAP-dm-file-bridge ficou deferida na versão 1). O mais próximo é a cópia de segurança: `server/services/backupService.ts` lê um JSON validado por esquema (`server/validation/backupSchemas.ts`), dentro de transação, e `src/features/settings/BackupSection.tsx` escolhe o arquivo. O catálogo de perguntas está em `shared/content/questionBank.ts` | new | Gerar o arquivo de questionário, aceitar o arquivo de respostas com validação e transformá-lo num rascunho da empresa |
| CAP-ra-data-continuity | Migração inicial `prisma/migrations/20261023000000_init`; `manifest.json` com `compatibility.schema_version: 1`. A cópia de segurança (`backupSchemas.ts`) tem `BACKUP_FORMAT_VERSION = 1`, esquema estrito e limite de 10 MB. `scripts/smoke-migrate.mjs` e `scripts/smoke-store-package.mjs` provam que uma atualização preserva os dados | extend | Esquema versão 2 por migração versionada; cópia de segurança versão 2 com os registros novos, ainda aceitando a versão 1 |

## MVP scope

**Parte 1: relatórios, marca e acabamento.**
- Central de relatórios em três pontos de entrada, com prévia paginada.
- PDF do diagnóstico novo, PDF de evolução e PDF da carteira.
- "Abrir PDF" e "Mostrar na pasta".
- Marca de quem entrega.
- Acabamento do resultado e do PDF.
- O tour da versão 1 continua até a parte 2.

**Parte 2: ações, lembrete e diário.**
- Andamento e herança das ações.
- Abas Ações e Diário na empresa.
- Tela inicial com contagem e indicadores.
- Intervalo de reavaliação.
- Diário mensal e números do diário no próximo diagnóstico.
- O andamento das ações entra nos PDFs do diagnóstico e da evolução, e as ações vencidas entram na carteira.
- Novo tour de apresentação, com os 5 passos (AC-ra-37). Ele precisa das abas Ações e Diário.

**Parte 3: questionário à distância.** Depende do teste Q-10.
- Gerar o arquivo de questionário e a mensagem ao cliente.
- O arquivo responde e salva.
- Importar as respostas, com recusa e substituição de rascunho.
- "Questionários aguardando" na tela inicial.

**Em todas as partes:** migração de esquema, cópia de segurança versão 2, telas em 390 px, movimento reduzido, modais do app e nenhuma requisição externa.

## Out of scope

| Fora | Motivo |
|---|---|
| Escolher a pasta onde salvar ("salvar como") | O webview do Play não oferece esse diálogo (F6, Q-3) |
| Aviso fora do app (notificação do sistema operacional, e-mail, WhatsApp) | O Play não tem canal de aviso para apps (F6, Q-5); o app não envia nada |
| Cor de destaque escolhida pelo usuário no PDF | F8: o PDF mantém as cores do FitPulse |
| Nome ou contato de outras pessoas (responsável por nome, contato do cliente) | F2 e LGPD da versão 1: responsável só por papel; contato só do próprio usuário |
| Ações próprias além das 3 do plano | F11 (Q-7) |
| CSV da carteira | F11 (Q-11), deferido |
| Origem dos clientes por canal no diário | Deferido (CAP-ra-diary-origin) |
| Diário levado pelo arquivo do questionário | F12, deferido |
| Questionário à distância no celular | F1: o formulário no celular não roda de forma confiável; o arquivo avisa para abrir no computador |
| O app enviar o questionário ou as respostas | O consultor envia por WhatsApp ou e-mail; o app só gera e importa arquivos |
| Importar planilha no diário | Briefing, frente 4: o público é leigo e o formato varia |
| Gráfico em radar | F11 (Q-4): barras são mais legíveis impressas |
| Plano por IA; benchmark entre empresas | PROM-009 deferido; PROM-010 não se aplica |

## User flows

**1. Gerar e abrir o relatório do diagnóstico (parte 1).**
1. Na página da empresa, aba "Relatórios" (ou "Relatórios" no resultado ou na tela inicial), o tipo "Diagnóstico" vem marcado com o último concluído.
2. À direita, a prévia mostra as páginas. Marcar "Incluir as respostas do questionário" acrescenta o apêndice na hora: a página "reimpressa" desce uma faixa e a prévia rola até ela.
3. "Exportar PDF" mostra "Salvando…" e depois "PDF salvo", com o nome do arquivo, a pasta, "Abrir PDF" e "Mostrar na pasta".
4. "Abrir PDF" abre o arquivo no leitor do computador.
- **Falha de gravação:** "Não foi possível salvar o PDF…", "Tentar de novo", nada muda.
- **Falha ao abrir:** "Não foi possível abrir. O arquivo está em {pasta}."
- **Empresa sem diagnóstico concluído:** estado vazio com o caminho para concluir um.

**2. Relatório de evolução (parte 1).** Com 2 ou mais concluídos, "Evolução" fica disponível, com "De" e "Até" (padrão: os dois mais recentes) → a prévia mostra "Antes e depois" → "Exportar PDF".
- **Com 1 diagnóstico:** a opção aparece desativada, com "A evolução precisa de 2 diagnósticos concluídos da mesma empresa."

**3. Relatório da carteira (parte 1, modo consultoria).** Na tela inicial, "Relatório da carteira" → a prévia mostra a carteira por estágio e as listas de atenção → "Exportar PDF".
- **No modo minha empresa:** a rota explica que o relatório é do modo consultoria, com o caminho para trocar o modo.
- **Sem empresas ativas:** explica e oferece "Cadastrar a primeira empresa".

**4. Marca de quem entrega (parte 1).** Configurações → "Seus relatórios": nome, logo, telefone, e-mail e site → "Salvar marca". A prévia da capa muda, e os próximos PDFs saem com a marca.
- **Validação:** logo inválida, telefone, e-mail ou site inválidos mostram o erro no campo e nada muda.
- **"Remover logo" e "Voltar para a marca FitPulse":** pedem confirmação.

**5. Acompanhar as ações (parte 2).**
1. Na tela inicial do dono, em "Suas 3 ações", ou na aba "Ações" da empresa, o usuário muda o estado de uma ação.
2. A mudança grava na hora e aparece "'{ação}' agora está {estado}." com "Desfazer".
3. "Editar" abre prazo, responsável e nota.
- **Prazo vencido:** a ação aparece como vencida na tela inicial.
- **Diagnóstico novo:** a ação que se repete aparece com "Continua do diagnóstico de {data}", e as outras ficam encerradas no diagnóstico anterior.

**6. Lembrete de reavaliação (parte 2).** A tela inicial do dono mostra "N dias até {data}", com a linha Último / Hoje / Próximo, ou "N dias de atraso desde {data}". O intervalo vem de Configurações: 60, 90 (padrão), 120 ou 180 dias. O consultor vê "Reavaliação atrasada" na carteira, e cada indicador abre a lista filtrada.

**7. Diário de números (parte 2).** Aba "Diário" → "Anotar um mês" → mês, clientes novos e as 6 partes do gasto (ou "Só sei o total do gasto") → "Anotar mês". A lista mostra o custo por cliente do mês e o progresso "N de 3 meses anotados".
- **Com 3 meses:** "Medido: de {mês} a {mês}".
- **Sem meses:** "Por que anotar todo mês?" com "Anotar o primeiro mês".
- **Mês repetido, mês futuro ou formato inválido:** erro no campo.
- **Excluir um mês:** pede confirmação.

**8. Próximo diagnóstico com o diário (parte 2).** "Novo diagnóstico" cria o rascunho com as respostas do último concluído (versão 1) e com o bloco "Seus números" preenchido pelo diário, marcado "do diário: {mês} a {mês}". O usuário corrige se quiser, conclui pelo portão em ouro, e o resultado diz de onde veio o custo por cliente.

**9. Questionário à distância (parte 3, modo consultoria).**
1. Na página da empresa, "Enviar questionário" → o diálogo explica o caminho → o arquivo é salvo em Downloads, com "Mostrar na pasta" e a mensagem pronta para "Copiar mensagem". A empresa mostra "Questionário enviado em {data}".
2. O cliente abre o arquivo no computador, responde os 8 blocos, revisa ("N de 8 blocos respondidos") e clica em "Salvar minhas respostas". O navegador baixa o arquivo de respostas, e a tela diz para enviar ao consultor.
3. O consultor clica em "Importar respostas" → "Lendo o arquivo…" → "Rascunho criado" → "Revisar e concluir".
- **Arquivo de outra empresa, de versão mais nova, incompatível ou corrompido:** mensagem específica, "Nada foi alterado." e "Escolher outro arquivo".
- **Rascunho existente:** "Substituir o rascunho de {data}?".

## Business Rules

| Rule | Statement | Kind | Applies to | Source |
|---|---|---|---|---|
| RULE-ra-01 | O resultado de um diagnóstico concluído nunca muda (RULE-dm-11 da versão 1). O andamento das ações, o diário, a marca e os questionários enviados são registros próprios; nenhum deles reescreve o resultado guardado | invariant | feature-wide | R-3; RULE-dm-11 |
| RULE-ra-02 | O relatório de evolução usa a mesma comparação da tela "Comparar", inclusive o recálculo do anterior quando as versões das regras diferem e o aviso que explica qual número vale. Só existe com 2 diagnósticos concluídos e não arquivados da mesma empresa | rule | CAP-ra-evolution-report | F9 |
| RULE-ra-03 | Marca de quem entrega:<br>• nome até 80 caracteres;<br>• logo PNG ou JPG de até 2 MB, reduzida para no máximo 600 px no lado maior antes de ser guardada;<br>• contato do próprio usuário: telefone fixo `(11) 1234-5678` ou celular `(11) 91234-5678`, e-mail e site, todos opcionais.<br>Sem cor de destaque. Tudo em branco significa a marca FitPulse | rule | CAP-ra-brand | F2, F7, F8 |
| RULE-ra-04 | Andamento de uma ação:<br>• estado: A fazer, Em andamento, Feita ou Não se aplica;<br>• prazo opcional, em `DD/MM/AAAA`;<br>• responsável opcional, escolhido entre Dono, Equipe de vendas, Equipe de marketing, Consultor e Outro, sem nome de pessoa;<br>• nota opcional de até 500 caracteres.<br>Ação nova começa "A fazer", sem prazo, responsável nem nota. Só as 3 ações do plano têm andamento | rule | CAP-ra-action-tracking | F2, F11 |
| RULE-ra-05 | Quando um diagnóstico é concluído, o plano dele é comparado, pela chave da ação do catálogo, com o plano do último diagnóstico concluído e não arquivado da mesma empresa:<br>• a ação que se repete herda estado, prazo, responsável e nota;<br>• as ações do plano anterior que não se repetem ficam encerradas no diagnóstico anterior, com o estado em que estavam;<br>• as ações novas começam "A fazer".<br>Cada chave aparece uma vez por plano | rule | CAP-ra-action-inheritance | F3, R-11 |
| RULE-ra-06 | Uma ação está vencida quando tem prazo anterior a hoje e está "A fazer" ou "Em andamento". Cada ação conta uma vez. "Hoje" é a data local do computador. Só contam as ações do plano atual de empresas ativas. O plano atual é o do último diagnóstico concluído e não arquivado; os planos anteriores estão encerrados | rule | CAP-ra-home-followup, CAP-ra-portfolio-report | Briefing frente 3; protótipo (contagem única) |
| RULE-ra-07 | A data de reavaliação é a data do último diagnóstico concluído e não arquivado mais o intervalo escolhido: 60, 90, 120 ou 180 dias, com 90 como padrão. A reavaliação está atrasada quando a data já passou (data local do computador). Uma empresa ativa sem diagnóstico concluído aparece como "sem diagnóstico". O mesmo intervalo vale para a tela inicial do dono, para a do consultor e para o relatório da carteira | rule | CAP-ra-home-followup, CAP-ra-portfolio-report | Briefing frente 3 |
| RULE-ra-08 | Diário: no máximo um registro por empresa e mês (`MM/AAAA`), sem mês futuro.<br>• O gasto vem nas 6 partes da calculadora ou como um total único, sempre em centavos inteiros.<br>• Os clientes novos são um número inteiro de 0 a 99.999.<br>• O custo por cliente do mês é o gasto dividido pelos clientes novos, arredondado ao centavo como na versão 1.<br>• Com 0 clientes novos, o custo do mês é "não calculado".<br>O mês de um registro não muda: para trocar o mês, exclua e anote de novo, porque o mês identifica o registro | rule | CAP-ra-diary | F5; regra de dinheiro em centavos |
| RULE-ra-09 | Quando um rascunho é criado, o bloco "Seus números" recebe os números do diário da empresa, pelos 3 meses mais recentes anotados.<br>**3 meses ou mais:**<br>• gasto = soma dos 3 meses, por parte (ou como total, se algum deles tem só o total);<br>• clientes novos = soma dos 3 meses;<br>• ambos contam como **medidos**.<br>**1 ou 2 meses:** a média mensal multiplicada por 3 aparece como sugestão. Se o usuário aceitar, ela conta como **estimada**.<br>**Nenhum mês:** a versão 1 continua igual.<br>Os números da calculadora são os totais dos "últimos 3 meses" (`shared/content/calculatorOptions.ts`), por isso a soma: o custo por cliente é o mesmo da média mensal. Um número corrigido à mão perde a marca "do diário" e segue a regra da versão 1 | rule | CAP-ra-diary-prefill | F4, F5, R-9 |
| RULE-ra-10 | Um arquivo de respostas só vira rascunho se for válido, da mesma empresa e de uma versão do questionário que o app conhece. Arquivos com mais de 1 MB, inválidos, de outra empresa, de versão mais nova ou incompatíveis são recusados sem alterar nada. Cada empresa tem um rascunho só (RULE-dm-13), por isso a importação com rascunho existente pede confirmação para substituí-lo | rule | CAP-ra-remote-questionnaire | F1, R-4; RULE-dm-13 |
| RULE-ra-11 | O arquivo de questionário é um HTML único que funciona sem internet nem instalação, sem nenhuma requisição de rede. Leva só o nome da empresa, as perguntas, a ajuda e a marca de quem entrega, sem nenhum dado de outra empresa | invariant | CAP-ra-remote-questionnaire | F1, R-4; RULE-dm-19 |
| RULE-ra-12 | Mudar o estado de uma ação é uma edição de rotina, que pode ser desfeita: grava na hora e oferece "Desfazer", sem modal (regra `status-change-confirmation`: "routine edits save without interception"). Excluir, remover, apagar a marca, substituir um rascunho e arquivar sempre usam o modal do app | rule | CAP-ra-action-tracking, CAP-ra-diary, CAP-ra-brand, CAP-ra-remote-questionnaire | `.aioson/rules/status-change-confirmation.md`; protótipo `action-status-change-undo` |

## Decision Branches

| Branch | Condition | Expected behavior | AC |
|---|---|---|---|
| BR-ra-01 | A empresa não tem diagnóstico concluído | A central mostra o estado vazio com o caminho para começar ou continuar o diagnóstico, sem botão de exportar | AC-ra-03 |
| BR-ra-02 | A empresa tem só 1 diagnóstico concluído e não arquivado | "Evolução" aparece desativada, com a explicação | AC-ra-03 |
| BR-ra-03 | A rota da carteira é aberta no modo minha empresa | Explicação de que o relatório é do modo consultoria, com o caminho para trocar o modo | AC-ra-16 |
| BR-ra-04 | Marca toda em branco | Capa e rodapé com a marca FitPulse | AC-ra-22 |
| BR-ra-05 | Logo em outro formato (inclusive SVG) ou com mais de 2 MB | Recusada com mensagem; nada muda | AC-ra-21 |
| BR-ra-06 | O sistema não consegue abrir o PDF ou a pasta | "Não foi possível abrir. O arquivo está em {pasta}." | AC-ra-18 |
| BR-ra-07 | A gravação do PDF falha | Erro com "Tentar de novo"; nada muda | AC-ra-19 |
| BR-ra-08 | O usuário desliga "Incluir as respostas do questionário" (padrão) | O PDF não traz respostas nem os valores digitados na calculadora | AC-ra-09 |
| BR-ra-09 | Uma ação do plano novo existe no plano anterior; uma ação do anterior não se repete; uma ação é nova | Herda o andamento; fica encerrada; começa "A fazer" | AC-ra-31 |
| BR-ra-10 | O diagnóstico mais recente é arquivado | O plano do concluído anterior volta a ser o atual, com o andamento que tinha | AC-ra-32 |
| BR-ra-11 | Prazo anterior a hoje e estado "A fazer" ou "Em andamento" | A ação conta como vencida, uma vez | AC-ra-33, AC-ra-35 |
| BR-ra-12 | A data de reavaliação já passou | "N dias de atraso desde {data}" e a empresa entra em "Reavaliação atrasada" | AC-ra-33, AC-ra-35 |
| BR-ra-13 | Mês já anotado, mês futuro ou formato inválido | Erro no campo; nada é gravado | AC-ra-39 |
| BR-ra-14 | Mês com 0 clientes novos | Custo do mês "não calculado" | AC-ra-41 |
| BR-ra-15 | Diário com 3 meses ou mais, com 1 ou 2, ou sem meses | Medido; sugestão estimada; versão 1 sem mudança | AC-ra-44, AC-ra-45 |
| BR-ra-16 | O usuário corrige à mão um número vindo do diário | Perde a marca "do diário" e segue a regra da versão 1 | AC-ra-46 |
| BR-ra-17 | Arquivo de respostas de outra empresa, de versão mais nova, incompatível, corrompido ou grande demais | Recusado com a mensagem específica; nada muda | AC-ra-52 |
| BR-ra-18 | A empresa já tem um rascunho na hora de importar | "Substituir o rascunho de {data}?"; cancelar mantém o atual | AC-ra-53 |
| BR-ra-19 | Importar uma cópia de segurança da versão 1 | Importa como antes, sem marca, ações nem diário | AC-ra-55 |
| BR-ra-20 | O cliente abre o arquivo de questionário no celular | Aviso para abrir no computador | AC-ra-49 |
| BR-ra-21 | A empresa não tem diagnóstico concluído e o usuário abre a aba "Ações" | Estado vazio com o caminho para o diagnóstico | AC-ra-63 |

## Acceptance Criteria

| AC | CAP | Observable behavior | Evidence |
|---|---|---|---|
| AC-ra-01 | CAP-ra-report-center | "Relatórios" abre a central da empresa a partir de três lugares: a aba "Relatórios" da página da empresa, o topo do resultado e a tela inicial do dono. No modo consultoria, a tela inicial tem também "Relatório da carteira". A central mostra à esquerda o tipo, o diagnóstico ou o par e as opções; à direita, a prévia paginada | teste e2e · interação do protótipo: `report-type-diagnosis`, `portfolio-report` |
| AC-ra-02 | CAP-ra-report-center | Trocar o tipo, o diagnóstico, o par da evolução ou a opção de respostas muda a prévia na hora. A prévia tem as mesmas páginas, na mesma ordem e com os mesmos títulos e números do PDF exportado a seguir. A página alterada é destacada, com a faixa de "reimpressão" e a rolagem até ela | teste e2e comparando os títulos da prévia com o texto do PDF (unpdf) · interação do protótipo: `report-type-evolution`, `report-include-answers` |
| AC-ra-03 | CAP-ra-report-center | Empresa sem diagnóstico concluído: a central mostra o estado vazio com o caminho para começar ou continuar o diagnóstico e não oferece exportar. Com 1 diagnóstico concluído, "Evolução" fica desativada e explica "A evolução precisa de 2 diagnósticos concluídos da mesma empresa." | teste e2e |
| AC-ra-04 | CAP-ra-report-center | Enquanto a central carrega, aparece o estado de carregamento (`aria-busy`). Uma falha ao ler os dados mostra o erro (`role="alert"`) com "Tentar de novo", sem prévia parcial | teste e2e com falha simulada na API |
| AC-ra-05 | CAP-ra-diagnosis-report | O PDF do diagnóstico tem, nesta ordem:<br>1. capa com a marca de quem entrega, a empresa, a data, a versão do cálculo e a confiança;<br>2. resumo executivo: estágio, trava, as 3 ações, custo por cliente e relação lucro ÷ custo;<br>3. notas das 8 dimensões;<br>4. riscos;<br>5. seus números, com a explicação de cada um;<br>6. andamento das ações, quando houver;<br>7. "Como ler este relatório";<br>8. as respostas, só se a opção estiver marcada | teste de unidade do PDF (texto extraído com unpdf) + teste e2e da exportação · interação do protótipo: `report-export-pdf` |
| AC-ra-06 | CAP-ra-diagnosis-report | O resumo executivo ocupa exatamente uma página: estágio, trava, as 3 ações e os números-chave ficam na mesma página, e a página seguinte começa nas dimensões | teste de unidade do PDF (texto por página) |
| AC-ra-07 | CAP-ra-diagnosis-report | As 8 dimensões aparecem em barras agrupadas em "Encaixes do negócio" e "Frentes de crescimento", cada barra com a nota escrita e a linha de 50. Impressa em preto e branco, nenhuma informação depende só da cor | teste de unidade do PDF + inspeção de uma impressão em escala de cinza |
| AC-ra-08 | CAP-ra-diagnosis-report | A página de riscos tem a matriz 5×5 (probabilidade × impacto), com cada risco marcado pelo número dele, e ao lado a lista com título, nota P × I, nível e "Como reduzir:". Sem riscos, a página diz "Nenhum risco encontrado nas respostas" | teste de unidade do PDF |
| AC-ra-09 | CAP-ra-diagnosis-report | "Incluir as respostas do questionário" vem desligado e explica por quê (as respostas trazem valores em reais). Ligado, o PDF ganha o apêndice com as 24 perguntas e a resposta escolhida, e os 6 números da calculadora. Desligado, o PDF não traz as respostas nem os valores digitados na calculadora (gasto, compra média, margem), só os números calculados | teste de unidade do PDF com a opção ligada e desligada · interação do protótipo: `report-include-answers` |
| AC-ra-10 | CAP-ra-diagnosis-report, CAP-ra-polish | "Como ler este relatório" traz o texto aprovado do `## Conteúdo v2` e explica que o estágio depende das condições de cada degrau (RULE-dm-04). Nenhum PDF diz que o estágio é o da dimensão mais fraca | teste de unidade do PDF (frase presente e frase proibida ausente) |
| AC-ra-11 | CAP-ra-diagnosis-report, CAP-ra-evolution-report, CAP-ra-portfolio-report | Nenhum PDF contém os termos proibidos da RULE-dm-14. O aviso "Orientação baseada nas respostas da empresa. Não substitui uma análise financeira." aparece no resumo e em "Como ler" | teste de unidade dos três PDFs |
| AC-ra-12 | CAP-ra-evolution-report | Com 2 ou mais diagnósticos concluídos, "Evolução" oferece "De" e "Até" (padrão: os dois mais recentes). O PDF tem:<br>• capa;<br>• "Antes e depois": estágio antes → depois, custo por cliente, média das 8 dimensões, trava antes e agora, barras antes e depois com a diferença escrita;<br>• "O que foi feito no período" (parte 2): ações do diagnóstico "De" com o estado e se continuam no plano novo, mais o custo por cliente do diário no período. Antes da parte 2, ou sem andamento e sem diário no período, essa página não aparece;<br>• "Como ler" | teste de unidade do PDF · interação do protótipo: `report-type-evolution` |
| AC-ra-13 | CAP-ra-evolution-report | Para o mesmo par, os estágios, as notas e as diferenças do PDF de evolução são iguais aos da tela "Comparar". Quando as versões das regras diferem, o PDF traz o mesmo aviso de recálculo da tela (RULE-ra-02) | teste de unidade comparando o PDF com a saída da comparação, com `tests/fixtures/rulesV2.ts` |
| AC-ra-14 | CAP-ra-evolution-report | A lista "Até" só oferece diagnósticos posteriores ao escolhido em "De"; trocar "De" para depois de "Até" ajusta "Até" para o seguinte | teste e2e |
| AC-ra-15 | CAP-ra-portfolio-report | No modo consultoria, o PDF da carteira tem capa, empresas por estágio e a lista das empresas ativas com estágio, data do último diagnóstico, reavaliação atrasada (RULE-ra-07), risco alto e, com a parte 2, ações vencidas (RULE-ra-06); antes da parte 2, a coluna não aparece. Os números são os mesmos da tela inicial do consultor | teste de unidade do PDF + teste de API · interação do protótipo: `portfolio-report` |
| AC-ra-16 | CAP-ra-portfolio-report | No modo minha empresa, a rota da carteira explica que o relatório é do modo consultoria e leva a Configurações para trocar o modo. Com a carteira vazia, explica que não há empresas ativas e oferece "Cadastrar a primeira empresa" | teste e2e |
| AC-ra-17 | CAP-ra-pdf-delivery | "Exportar PDF" mostra "Salvando…" e depois "PDF salvo", com o nome do arquivo, a pasta, "Abrir PDF" e "Mostrar na pasta". Os nomes são `{empresa}-{data}.pdf`, `{empresa}-evolucao-{de}-a-{ate}.pdf` e `carteira-{data}.pdf`, com datas `AAAA-MM-DD` e nomes saneados como na versão 1; um nome repetido ganha " (2)" | teste de API + teste e2e · interação do protótipo: `report-export-pdf` |
| AC-ra-18 | CAP-ra-pdf-delivery | "Abrir PDF" abre o arquivo no leitor padrão do computador e "Mostrar na pasta" abre a pasta Downloads com o arquivo, pelo backend do app. O pedido só identifica um arquivo que o próprio app salvou na pasta Downloads; nenhum caminho vem da tela. Se o sistema não conseguir abrir, aparece "Não foi possível abrir. O arquivo está em {pasta}." | teste de API (arquivo do app aceito, nome fora da pasta recusado, falha do sistema) + smoke manual no webview do Play · interação do protótipo: `report-open-pdf`, `report-show-folder` |
| AC-ra-19 | CAP-ra-pdf-delivery | Uma falha de gravação mostra o erro com "Tentar de novo", a central continua aberta e nada muda; tentar de novo depois de resolvida a falha salva o arquivo | teste e2e com falha de gravação simulada · interação do protótipo: `report-export-failure-retry` |
| AC-ra-20 | CAP-ra-brand | Configurações → "Seus relatórios" tem nome de quem entrega (até 80 caracteres), telefone com máscara `(11) 91234-5678` ou `(11) 1234-5678` (`inputmode="tel"`), e-mail e site.<br>• Ao sair do campo, um valor inválido mostra no próprio campo "Telefone inválido. Use (11) 91234-5678.", "E-mail inválido. Use nome@empresa.com.br." ou "Site inválido. Use empresa.com.br.", com `aria-invalid`.<br>• "Salvar marca" grava e a prévia da capa muda na hora.<br>• No modo minha empresa, o rótulo fala da própria empresa | teste e2e com valores válidos e inválidos · interação do protótipo: `brand-save` |
| AC-ra-21 | CAP-ra-brand | A logo aceita PNG ou JPG de até 2 MB. A imagem guardada tem no máximo 600 px no lado maior. O formato é conferido pelo conteúdo do arquivo, não só pela extensão. Qualquer outro formato (inclusive SVG, ou um arquivo renomeado para .png) ou um arquivo maior que 2 MB é recusado com "Use uma imagem PNG ou JPG de até 2 MB." e nada muda (RULE-ra-03). "Remover logo" e "Voltar para a marca FitPulse" pedem confirmação no modal do app | teste de API (PNG, JPG, SVG, texto renomeado para .png, arquivo de 3 MB) + teste e2e · interação do protótipo: `brand-logo-upload`, `brand-logo-remove`, `brand-reset` |
| AC-ra-22 | CAP-ra-brand | Com a marca preenchida, a capa e o rodapé dos três PDFs mostram o nome, a logo e o contato. Com tudo em branco, mostram a marca FitPulse. As cores do PDF são sempre as do FitPulse | teste de unidade dos PDFs com e sem marca |
| AC-ra-23 | CAP-ra-polish | A confiança diz "1 de 26 itens sem o número" (sempre "itens") na tela e no PDF | teste de unidade |
| AC-ra-24 | CAP-ra-polish | Na lista de riscos do resultado, "Probabilidade P de 5", "Impacto I de 5" e "Nota P × I = N" nunca quebram no meio do rótulo, em 1280 px e em 390 px | teste e2e nas duas larguras |
| AC-ra-25 | CAP-ra-polish | No topo do resultado ficam "Relatórios" e "Exportar PDF", este com destaque de botão principal. "Exportar PDF" salva direto o relatório do diagnóstico com as opções padrão (respostas desligadas) e mostra o mesmo estado de entrega da AC-ra-17. Depois de salvar, a mensagem com o nome do arquivo e a pasta fica visível até o usuário fechar | teste e2e |
| AC-ra-26 | CAP-ra-action-tracking | Cada ação do plano atual mostra estado, prazo, responsável e nota na aba "Ações" da empresa, no resultado e em "Suas 3 ações" na tela inicial do dono. Uma ação nova começa "A fazer", sem prazo, responsável nem nota (RULE-ra-04) | teste e2e |
| AC-ra-27 | CAP-ra-action-tracking | Mudar o estado grava na hora e mostra "'{ação}' agora está {estado}." com "Desfazer" por 6 segundos. "Desfazer" volta ao estado anterior e grava de novo. Recarregar mostra o estado gravado (RULE-ra-12) | teste e2e com recarga · interação do protótipo: `action-status-change-undo` |
| AC-ra-28 | CAP-ra-action-tracking | "Editar" abre o formulário com:<br>• prazo com máscara `DD/MM/AAAA` (`inputmode="numeric"`), com data inválida recusada ao sair do campo e mensagem no campo;<br>• responsável na lista de papéis, sem campo de nome;<br>• nota de até 500 caracteres, com contador.<br>Salvar altera só aquela ação; os mesmos campos voltam preenchidos ao editar de novo | teste e2e (formulário, edição de uma ação específica) · interação do protótipo: `action-edit-due-role-note` |
| AC-ra-29 | CAP-ra-action-tracking | Mudar o andamento de uma ação ou concluir um diagnóstico novo não altera o resultado guardado de nenhum diagnóstico. A comparação e o PDF de um diagnóstico anterior continuam iguais (RULE-ra-01) | teste de API comparando o resultado antes e depois |
| AC-ra-30 | CAP-ra-action-tracking | O resultado de um diagnóstico cujo plano foi substituído mostra as 3 ações como encerradas, com o estado em que ficaram e sem controles de edição | teste e2e |
| AC-ra-63 | CAP-ra-action-tracking | Empresa sem diagnóstico concluído: a aba "Ações" mostra o estado vazio, que explica que as ações nascem do diagnóstico, com o caminho para começar ou continuar o diagnóstico. Rascunhos não têm ações | teste e2e |
| AC-ra-31 | CAP-ra-action-inheritance | Ao concluir um diagnóstico novo:<br>• a ação que se repete herda estado, prazo, responsável e nota e mostra "Continua do diagnóstico de {data}";<br>• as que não se repetem ficam encerradas no anterior;<br>• as novas começam "A fazer".<br>Nenhuma ação aparece duas vezes no plano atual (RULE-ra-05) | teste de unidade (repetida, nova e encerrada) + teste de API · interação do protótipo: `action-inherited-from-previous` |
| AC-ra-32 | CAP-ra-action-inheritance | Ao arquivar o diagnóstico mais recente, o plano do concluído anterior volta a ser o atual, com o andamento que tinha. Restaurar devolve a situação. Excluir a empresa apaga junto o andamento das ações e o diário dela | teste de API |
| AC-ra-33 | CAP-ra-home-followup | A tela inicial do dono tem como foco "Refazer o diagnóstico", com:<br>• "N dias até {data}" ou "N dias de atraso desde {data}";<br>• a linha Último / Hoje / Próximo;<br>• o intervalo escolhido e a trava atual;<br>• a frase de que o lembrete aparece só no app.<br>Abaixo ficam "Ações do plano" (feitas, em andamento, a fazer, vencidas), "Diário de números" (custo pelo diário e meses anotados) e "Relatórios" (último PDF salvo ou convite), cada um abrindo a aba certa, e "Suas 3 ações" com o estado editável. Com um rascunho, "Continuar de onde parei" aparece como na versão 1 | teste e2e · interação do protótipo: `reevaluation-countdown`, `home-widget-drilldown` |
| AC-ra-34 | CAP-ra-home-followup | Configurações → "Lembrete de reavaliação" oferece 60, 90 (padrão, "recomendado"), 120 e 180 dias. A escolha muda a contagem na hora e continua depois de fechar e abrir o app | teste e2e com recarga · interação do protótipo: `reevaluation-interval-setting` |
| AC-ra-35 | CAP-ra-home-followup | Na tela inicial do consultor, o foco continua "Empresas por estágio". "O que precisa de você" lista:<br>• reavaliação atrasada (RULE-ra-07);<br>• ações vencidas (RULE-ra-06);<br>• risco alto;<br>• questionários aguardando resposta (parte 3);<br>• rascunhos parados (versão 1).<br>Cada indicador abre a lista de empresas filtrada pelo que mostrou. A lista diz qual filtro está ativo, mostra "Nenhuma empresa encontrada" quando o filtro fica vazio e oferece "Limpar filtros" (como na AC-dm-09) | teste e2e · interação do protótipo: `home-widget-drilldown` |
| AC-ra-36 | CAP-ra-home-followup | Os indicadores seguem os dados: marcar como "Feita" uma ação vencida, concluir um diagnóstico, mudar o intervalo ou importar respostas muda os números das telas iniciais na próxima abertura. Nenhum número é fixo | teste e2e mudando os dados |
| AC-ra-37 | CAP-ra-home-followup | Com a parte 2, o tour de apresentação passa a ter os 5 passos do protótipo: relatórios, marca, ações, diário e modo. Ele aparece uma vez para quem já usava a versão 1, pode ser pulado e volta pelo "?" do topo | teste e2e · interação do protótipo: `tour-reopen` |
| AC-ra-38 | CAP-ra-diary | Na aba "Diário", "Anotar um mês" abre o formulário com:<br>• mês com máscara `MM/AAAA` (`inputmode="numeric"`);<br>• clientes novos, inteiro de até 5 dígitos;<br>• gasto nas 6 partes da calculadora com máscara de reais, ou "Só sei o total do gasto" com um campo único.<br>"Anotar mês" grava e mostra o mês na lista com o custo por cliente | teste e2e (formulário) · interação do protótipo: `diary-add-month`, `diary-total-only` |
| AC-ra-39 | CAP-ra-diary | Cada erro aparece no próprio campo, e nada é gravado:<br>• mês futuro;<br>• mês inválido;<br>• mês já anotado: "{Mês} já está no diário. Edite o mês em vez de anotar de novo.";<br>• clientes vazios;<br>• gasto vazio: "Preencha pelo menos uma parte do gasto, ou marque 'Só sei o total'."<br>O servidor recusa o mesmo mês repetido para a mesma empresa | teste e2e + teste de API |
| AC-ra-40 | CAP-ra-diary | "Editar" um mês mostra os mesmos campos preenchidos, com o mês só para leitura e a explicação "Para mudar o mês, exclua e anote de novo." (RULE-ra-08). "Excluir" pede "Excluir {mês} do diário?" com a consequência e "Excluir mês"; cancelar não muda nada | teste e2e · interação do protótipo: `diary-edit-month`, `diary-delete-month` |
| AC-ra-41 | CAP-ra-diary | Com 0 clientes novos, o custo do mês é "não calculado". A aba mostra:<br>• o gráfico do custo por cliente dos últimos 6 meses anotados, com o valor escrito em cada barra e uma frase-resumo;<br>• o progresso "N de 3 meses anotados", ou "Medido: de {mês} a {mês}" com 3 ou mais.<br>Nenhuma tela mostra "NaN", "Infinity" ou valor vazio | teste e2e · interação do protótipo: `diary-measured-after-three-months` |
| AC-ra-42 | CAP-ra-diary | Sem meses anotados, aparece o estado vazio "Por que anotar todo mês?", com o texto aprovado e "Anotar o primeiro mês". No modo consultoria, a aba diz que o consultor anota os números do cliente (F12) | teste e2e |
| AC-ra-43 | CAP-ra-diary | O gasto do diário vai e volta da API em centavos inteiros. Um valor com fração de centavo, negativo ou acima de R$ 99.999.999,99 é recusado | teste de API |
| AC-ra-44 | CAP-ra-diary-prefill | Com 3 meses ou mais anotados, "Novo diagnóstico" cria o rascunho com o bloco "Seus números" já preenchido: gasto e clientes novos são a soma dos 3 meses mais recentes, com a marca "do diário: {mês} a {mês}". Se algum dos 3 meses tem só o total, o gasto aparece como um total único, sem divisão por parte, e o painel recalcula igual. Ao concluir, o custo por cliente conta como medido para a RULE-dm-04 e a confiança (RULE-ra-09) | teste de unidade + teste e2e |
| AC-ra-45 | CAP-ra-diary-prefill | Com 1 ou 2 meses, o bloco oferece "Usar o diário", com o valor projetado para 3 meses e a marca "do diário: N mês(es), estimado". Aceito, conta como estimado: a confiança não passa de média (AC-dm-49). Sem meses, o bloco é igual ao da versão 1 | teste de unidade + teste e2e |
| AC-ra-46 | CAP-ra-diary-prefill | Qualquer número vindo do diário pode ser corrigido antes de concluir; corrigido, perde a marca "do diário" e segue a regra da versão 1. O resultado concluído mostra de onde veio o custo por cliente ("do diário, medido", "do diário, estimado" ou o que foi digitado). Mudar o diário depois não altera um rascunho já criado nem um diagnóstico concluído | teste e2e + teste de API |
| AC-ra-47 | CAP-ra-diary-prefill | Com o diário, as respostas do questionário continuam vindo do último diagnóstico concluído, como na versão 1 (AC-dm-13); só o bloco "Seus números" muda de origem | teste de API |
| AC-ra-48 | CAP-ra-remote-questionnaire | No modo consultoria, a página da empresa tem "Enviar questionário".<br>• O diálogo explica o caminho em 3 passos e salva `{empresa}-questionario-{data}.html` (data `AAAA-MM-DD`) na pasta Downloads, com "Mostrar na pasta" e a mensagem aprovada ao cliente com "Copiar mensagem".<br>• Se a cópia automática falhar, o texto fica selecionável, com a dica de copiar à mão.<br>• A empresa passa a mostrar "Questionário enviado em {data}" e entra em "Questionários aguardando resposta" | teste e2e · interação do protótipo: `remote-questionnaire-send` |
| AC-ra-49 | CAP-ra-remote-questionnaire | O arquivo abre direto no Chrome, no Edge, no Firefox e no Safari de um computador, sem internet e sem instalar nada.<br>• Mostra o aviso aprovado de abrir no computador; numa tela estreita, o aviso fica em destaque.<br>• Tem os 8 blocos e as 24 perguntas com a ajuda, "não sei" só onde o catálogo permite e os 6 campos da calculadora com as mesmas máscaras.<br>• Não faz nenhuma requisição de rede (RULE-ra-11) | teste e2e que abre o arquivo gerado no Chromium com a rede cortada + smoke manual nos 4 navegadores (Q-10) · interação do protótipo: `remote-questionnaire-client-answer` |
| AC-ra-50 | CAP-ra-remote-questionnaire | No fim, o arquivo mostra "Revise e salve", com "N de 8 blocos respondidos" e um link para cada bloco que falta; dá para salvar com blocos faltando. "Salvar minhas respostas" baixa `respostas-{empresa}.fitpulse` e mostra "Respostas salvas", com a instrução aprovada de enviar a quem entrega (nome e contato da marca, se houver) | teste e2e no arquivo gerado |
| AC-ra-51 | CAP-ra-remote-questionnaire | "Importar respostas" aceita o arquivo, mostra "Lendo o arquivo…" e cria um rascunho da empresa com as respostas e os números, marcado "Respostas do cliente, salvas em {data}". "Revisar e concluir" abre o rascunho, que conclui pelo portão normal (AC-dm-14). A empresa sai de "Questionários aguardando resposta" | teste de API + teste e2e · interação do protótipo: `remote-questionnaire-import` |
| AC-ra-52 | CAP-ra-remote-questionnaire | Um arquivo de outra empresa ("Este arquivo é de {empresa}, não de {empresa atual}."), de versão mais nova, de questionário incompatível, corrompido ("Este arquivo não é um arquivo de respostas do FitPulse.") ou com mais de 1 MB é recusado com a mensagem específica (`role="alert"`), "Nada foi alterado." e "Escolher outro arquivo". Nenhum dado muda (RULE-ra-10) | teste de API com cada tipo de arquivo + teste e2e · interação do protótipo: `remote-questionnaire-import-errors` |
| AC-ra-53 | CAP-ra-remote-questionnaire | Se a empresa já tem um rascunho, importar pede "Substituir o rascunho de {data}?", com a consequência e o verbo no botão. Cancelar mantém o rascunho atual; confirmar troca, e a empresa continua com um rascunho só | teste e2e (confirmar e cancelar) · interação do protótipo: `remote-questionnaire-replace-draft` |
| AC-ra-54 | CAP-ra-data-continuity | Atualizar pela loja uma instalação da versão 1 com dados mantém empresas, diagnósticos, rascunhos e preferências. `compatibility.schema_version` passa a 2 por migração versionada | `scripts/smoke-migrate.mjs` + `scripts/smoke-store-package.mjs` |
| AC-ra-55 | CAP-ra-data-continuity | "Exportar meus dados" gera a cópia na versão 2, com a marca (inclusive a logo), o intervalo de reavaliação, o andamento das ações, o diário e os questionários enviados. Importar essa cópia noutra instalação reproduz tudo. Importar uma cópia da versão 1 continua funcionando. Importar nunca apaga dados existentes | teste de API + teste e2e |
| AC-ra-56 | CAP-ra-data-continuity | `GET /api/aioson-play` continua listando só rotas que existem. O resumo para o assistente do Play não ganha valores em reais, diário, notas das ações nem a marca (RULE-dm-17) | teste de API |
| AC-ra-57 | CAP-ra-report-center, CAP-ra-brand, CAP-ra-action-tracking, CAP-ra-diary, CAP-ra-home-followup | Em 390 px de largura:<br>• nenhuma tela nova tem rolagem horizontal;<br>• a prévia empilha as páginas na vertical;<br>• os alvos de toque têm pelo menos 44 px ou ficam dentro de um rótulo clicável desse tamanho;<br>• o foco do teclado é sempre visível;<br>• o texto tem contraste de pelo menos 4,5:1 nos dois temas | teste e2e com axe nos dois temas · interação do protótipo: `switch-theme` |
| AC-ra-58 | CAP-ra-report-center, CAP-ra-home-followup, CAP-ra-diary | Com `prefers-reduced-motion: reduce`, nenhuma animação nova roda: faixa de reimpressão, entrada em sequência, revelação das páginas, traço sob a aba e poeira do fundo. As telas aparecem já no estado final | teste e2e com emulação de movimento reduzido |
| AC-ra-59 | CAP-ra-diary, CAP-ra-brand, CAP-ra-remote-questionnaire | Excluir um mês, remover a logo, voltar à marca FitPulse e substituir um rascunho usam o modal do app, com título, consequência, verbo no botão e "Cancelar". Esc cancela e o foco fica preso no modal. Nenhum `alert`, `confirm` ou `prompt` nativo | teste e2e (confirmar e cancelar em cada um) |
| AC-ra-60 | CAP-ra-report-center, CAP-ra-pdf-delivery | Com a rede externa desligada, a central gera e salva os três PDFs com as fontes embutidas. Nenhuma tela nova faz requisição fora de `127.0.0.1`/`localhost` (RULE-dm-19) | teste e2e com a fixture que reprova requisições externas |
| AC-ra-61 | CAP-ra-report-center | O botão "Relatórios" fica visível na primeira dobra da página da empresa e do resultado, em 1280 px e em 390 px | teste e2e nas duas larguras |
| AC-ra-62 | CAP-ra-home-followup | Trocar entre "Minha empresa" e "Consultoria" troca as telas iniciais e os rótulos da marca na hora; a troca continua depois de reabrir | teste e2e com recarga · interação do protótipo: `switch-usage-mode` |

## Conteúdo v2 (aprovado pelo dono em 2026-10-25)

Os três textos que o briefing reservou para o @product escrever e o dono aprovar (briefing, "Lacunas de conteúdo a escrever"). O dono aprovou os três em 2026-10-25: "aprovar os textos".

**1. "Como ler este relatório"** (última página dos PDFs do diagnóstico e da evolução)
- **Os 4 estágios.** Descoberta, Ajuste, Escala e Estruturação. Cada degrau tem condições próprias, e a empresa só sobe quando cumpre todas as do degrau seguinte. Para chegar à Escala, por exemplo, é preciso saber, com números anotados, quanto custa conquistar cada cliente novo. A primeira condição que falta é a trava, e é ela que o plano ataca primeiro.
- **Encaixes e frentes.** Os encaixes mostram se as peças do negócio combinam: mercado e produto, produto e canal, canal e receita, receita e mercado. As frentes mostram o que a empresa faz no dia a dia: aquisição, engajamento, conversão e retenção. Cada nota vai de 0 a 100, e abaixo de 50 é sinal de alerta. "Sustentaria o estágio N" diz até onde aquela dimensão levaria a empresa sozinha. As dimensões mais fracas viram ações do plano.
- **Custo e lucro por cliente.** O custo por cliente é o gasto para atrair clientes dividido pelos clientes novos do mesmo período. O lucro por cliente é o que ele deixa enquanto continua comprando, já descontado o custo do produto e da entrega. Quando o lucro fica entre 3 e 5 vezes o custo, a conta é saudável; abaixo de 1, cada cliente novo dá prejuízo.
- **Confiança nos dados.** É alta quando quase tudo foi medido. É média quando parte veio por faixa ou de um diário com menos de 3 meses. É baixa quando há muitos "não sei". Com 3 meses ou mais anotados no diário, o custo por cliente conta como medido.
- **Aviso.** Orientação baseada nas respostas da empresa. Não substitui uma análise financeira.

A frase de abertura da página das dimensões passa a ser: "Cada nota vai de 0 a 100. A linha marca 50: abaixo dela, a dimensão pede atenção. O estágio depende das condições de cada degrau, explicadas em 'Como ler'."

**2. Estado vazio do diário**
- Título: "Por que anotar todo mês?"
- Texto: "Com 3 meses de gasto para atrair clientes e de clientes novos, o FitPulse calcula sozinho quanto custa cada cliente. O próximo diagnóstico já vem com esse número medido."
- Botão: "Anotar o primeiro mês".
- Modo consultoria, acima: "Você anota os números do cliente: peça a ele o gasto e os clientes novos de cada mês."

**3. Questionário à distância**
- **Mensagem ao cliente** (no diálogo, para copiar): "Olá! Segue o questionário do FitPulse para a {empresa}. Abra o arquivo no computador (no celular ele pode não funcionar), responda com calma e, no fim, clique em "Salvar minhas respostas". Depois me envie o arquivo que for salvo. Leva uns 12 minutos." Na linha seguinte vem o nome de quem entrega, se houver.
- **Aviso no topo do arquivo:** "Feito para abrir no computador. No celular, o formulário pode não funcionar direito. Se estiver no celular, abra este arquivo no computador. Responda tudo de uma vez: se fechar esta página antes de salvar, as respostas se perdem."
- **Depois de salvar:** "Respostas salvas. O arquivo foi para a pasta de downloads deste computador: {arquivo}. Agora envie o arquivo para {quem entrega}{ pelo WhatsApp {telefone}}{ ou por e-mail para {e-mail}}. Ele importa as respostas no FitPulse e revisa com você." Sem marca, fica "para o seu consultor".

## Success metrics

O app não tem telemetria (versão 1), então cada meta é medida por teste com usuário ou pela observação dos próprios dados.

| Meta | Como medir | Quando |
|---|---|---|
| Uma pessoa leiga encontra, gera e abre um PDF em menos de 30 s, sem ajuda | Teste com 3 pessoas leigas no app real, cronometrado da tela inicial até o PDF aberto (meta proposta, sem linha de base) | Ao fim da parte 1 |
| O resumo executivo cabe em 1 página, e a marca configurada aparece na capa e no rodapé | Teste automático do PDF (AC-ra-06, AC-ra-22) | Toda entrega |
| Ações com estado definido 30 dias depois do diagnóstico | Contagem nas telas iniciais de quem usa (dono e carteira do consultor), observada pelo dono do produto | 30 dias após a parte 2 |
| O próximo diagnóstico sai com o custo por cliente "medido" depois de 3 meses de diário | Resultado do diagnóstico ("do diário, medido") nas empresas que anotaram 3 meses | 3 meses após a parte 2 |
| Uma importação válida vira rascunho sem redigitar nada | As 24 respostas e os 6 números conferidos no rascunho (AC-ra-51) | Ao fim da parte 3 |

## Prototype contract

- status: current
- feature: relatorios-e-acompanhamento
- prototype: .aioson/briefings/relatorios-e-acompanhamento/prototype.html
- manifest: .aioson/briefings/relatorios-e-acompanhamento/prototype-manifest.md
- manifest_status: approved (2026-10-25)
- identity: .aioson/briefings/relatorios-e-acompanhamento/identity.md

**O que o protótipo fixa:**
- **Telas** (as 12 do `## Screen inventory`):
  - central de relatórios (com prévia em papel paginada), relatórios vazios e relatório da carteira;
  - tela inicial nos dois modos e lista de empresas com filtros de atenção;
  - página da empresa com as abas Diagnósticos, Ações, Diário e Relatórios;
  - mudanças no resultado e Configurações ("Seus relatórios", lembrete);
  - o que o cliente vê no arquivo do questionário.
- **Estados:** carregando, vazio, erro e sucesso da `## Runtime matrix`. Permissão negada não se aplica, porque o app não tem login.
- **Interações:** as 31 do `## Core interactions`, todas citadas nos ACs.
- **Assinatura:** a folha de porcelana montada ao vivo sobre a tinta, com a capa levando a marca de quem entrega.

**Desvios aprovados neste PRD:**
1. **"Como ler" e a página das dimensões.** O protótipo diz que "a empresa fica no estágio que a sua dimensão mais fraca consegue sustentar". O produto usa o texto do `## Conteúdo v2`, que segue a RULE-dm-04. Motivo: a frase do protótipo descreve errado a regra do estágio, o mesmo defeito que o QA da versão 1 achou no PDF atual (OBS-9d1a49).
2. **Números do diário no bloco "Seus números".** O protótipo mostra "R$ 3.150,00 (do diário, média de 3 meses)" numa pergunta "no mês". O produto mantém a pergunta da versão 1 ("nos últimos 3 meses") e preenche a **soma** dos 3 meses (RULE-ra-09). Motivo: mudar a pergunta para "no mês" alteraria a calculadora aprovada da versão 1. O custo por cliente é o mesmo nos dois jeitos.
3. **Tela inicial do dono.** O layout do protótipo substitui a escada grande e o gráfico de evolução da média da versão 1 (AC-dm-32) pela contagem para refazer o diagnóstico. A evolução continua em "Comparar" e no relatório de evolução. "Continuar de onde parei" continua quando há rascunho, embora a base de demonstração não mostre esse caso.
4. **Tela inicial do consultor.** "Rascunhos parados" (versão 1, AC-dm-34) continua na lista "O que precisa de você", embora o protótipo não a mostre.
5. **Só no protótipo:**
   - a faixa e os dados de demonstração;
   - a lista de arquivos de exemplo na importação;
   - os botões de logo de exemplo;
   - 1 pergunta por bloco no questionário do cliente (o arquivo real leva as 24);
   - as empresas da consultoria visíveis no modo minha empresa.
6. **Máscaras.** As máscaras do protótipo só aceitam digitação no fim do campo. As do produto preservam a posição do cursor, como na versão 1.

## Visual identity

identity: .aioson/briefings/relatorios-e-acompanhamento/identity.md

identity_status: current (source: references; reuse da identidade do FitPulse por decisão F14)

**O que a identidade fixa:**
- Tinta & Ouro, com o bronze antigo como metal do FitPulse; o ouro fica só na marca e nos portões de decisão (como "Concluir o diagnóstico?").
- Três vozes: sans para a estrutura, serif itálica para a intenção humana (como a frase da trava) e mono para os valores de máquina (datas, números, nomes de arquivo).
- Profundidade só por bordas, sem sombra.
- O papel do PDF e da prévia tem paleta fixa (porcelana, bronze escuro, cobre e o perigo do tema claro), independente do tema da tela.
- Anti-objetivos do manifesto: PDF com cara de painel de BI, diário com cara de planilha genérica, acompanhamento com cara de kanban.

Composição, tokens e componentes ficam com o protótipo e com `src/styles/tokens.css`.

## Open questions

| # | Pergunta | Tipo | Bloqueia | Dono |
|---|---|---|---|---|
| Q-10 | Um `.html` com formulário, enviado por Gmail, Outlook e WhatsApp, chega e abre no Chrome, no Edge, no Firefox e no Safari do computador do cliente? Algum antivírus bloqueia? | testável | **Sim, para a parte 3** (não bloqueia as partes 1 e 2). Se falhar, a parte 3 volta ao @product para escolher entre as formas A e C | @planner (planejar o teste antes da fase 3) |
| OQ-ra-1 | "Abrir PDF" e "Mostrar na pasta", acionados pelo backend, funcionam com o app dentro do webview do Play no Windows e no macOS? | testável | Não; se um sistema falhar, fica a mensagem de onde o arquivo está (BR-ra-06) | @dev (smoke na parte 1) |
| OQ-ra-3 | Os 3 meses mais recentes do diário podem ser antigos (por exemplo, anotados há um ano) e ainda contar como medidos | risco conhecido | Não: o bloco mostra quais meses vieram ("do diário: {mês} a {mês}") e o usuário corrige antes de concluir (AC-ra-46). Rever na calibração das regras | @product |
| OQ-ra-2 | Os textos do `## Conteúdo v2` (Como ler, diário vazio, mensagem e avisos do questionário) | aprovação do dono | **Resolvida:** aprovados pelo dono em 2026-10-25 | Dono |
