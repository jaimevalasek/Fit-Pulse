# Refinement Report — relatorios-e-acompanhamento

- Source briefing: .aioson/briefings/relatorios-e-acompanhamento/briefings.md
- Feedback: .aioson/briefings/relatorios-e-acompanhamento/refinement-feedback.applied-round1.json
- Source hash: fd6133fa0e1131b283992492522e04fc16beed1ff4d44d65ced1ff2f88ba65b1
- Applied hash: fd0a1e854d4c618a0fead55259159119ee5ebbf4ce004756610bdebc8e12caba
- Status: applied
- Round: 1
- Next action: build_prototype
- Approved review authority: binding

## Approved Review Decisions

- F1 [structured_selection] proposed-solution: html-no-computador — Arquivo que abre no navegador do computador | rationale: O dono pediu para seguir com as recomendações ("pode prosseguir com o recomendado que você adicionou", 2026-10-24).
- F2 [structured_selection] risks: contato-proprio-responsavel-papel — Contato próprio sim; responsável por papel | rationale: O dono pediu para seguir com as recomendações ("pode prosseguir com o recomendado que você adicionou", 2026-10-24).
- F3 [structured_selection] proposed-solution: herdar-repetidas — Plano novo, herdando as que se repetem | rationale: O dono pediu para seguir com as recomendações ("pode prosseguir com o recomendado que você adicionou", 2026-10-24).
- F4 [structured_selection] open-questions: tres-meses — 3 meses | rationale: O dono pediu para seguir com as recomendações ("pode prosseguir com o recomendado que você adicionou", 2026-10-24).
- F5 [legacy_recommendation] proposed-solution: legacy-recommendation — O diário usa as mesmas 6 partes de gasto da calculadora e oferece o atalho "só sei o total". O preenchimento do próximo diagnóstico mostra a origem ("do diário: média de 3 meses") e deixa corrigir antes de concluir (R-9). | rationale: O dono pediu para seguir com as recomendações ("pode prosseguir com o recomendado que você adicionou", 2026-10-24).
- F6 [legacy_recommendation] identified-gaps: legacy-recommendation — Manter o salvamento na pasta Downloads, acrescentar os botões "Abrir PDF" e "Mostrar na pasta" e tirar "escolher a pasta". O lembrete de reavaliação e de ações vencidas aparece só dentro do app, na tela inicial. Q-3 e Q-5 ficam resolvidas assim. | rationale: O dono pediu para seguir com as recomendações ("pode prosseguir com o recomendado que você adicionou", 2026-10-24).
- F7 [legacy_recommendation] themes: legacy-recommendation — Aceitar logo PNG ou JPG de até 2 MB e reduzir para no máximo 600 px antes de guardar. Ela entra na cópia de segurança, e o importador continua aceitando cópias da versão 1, sem logo. | rationale: O dono pediu para seguir com as recomendações ("pode prosseguir com o recomendado que você adicionou", 2026-10-24).
- F8 [legacy_recommendation] proposed-solution: legacy-recommendation — Tirar a cor de destaque. A marca de quem entrega fica em nome, logo e contato; o PDF mantém as cores do FitPulse. | rationale: O dono pediu para seguir com as recomendações ("pode prosseguir com o recomendado que você adicionou", 2026-10-24).
- F9 [legacy_recommendation] proposed-solution: legacy-recommendation — O relatório de evolução usa o mesmo cálculo da tela de comparação, sem lógica própria, e só fica disponível quando a tela de comparação também está (2 diagnósticos concluídos da mesma empresa). | rationale: O dono pediu para seguir com as recomendações ("pode prosseguir com o recomendado que você adicionou", 2026-10-24).
- F10 [structured_selection] open-questions: fatiar-tres — Em 3 partes | rationale: O dono pediu para seguir com as recomendações ("pode prosseguir com o recomendado que você adicionou", 2026-10-24).
- F11 [legacy_recommendation] open-questions: legacy-recommendation — Apêndice com as respostas: opção na hora de exportar, desligada por padrão (Q-2). Gráfico das 8 dimensões: barras agrupadas por encaixes e frentes, com o número escrito, legível impresso em preto e branco (Q-4). Ações: só as 3 do plano, cada uma com nota livre, sem ações próprias nesta versão (Q-7). Exportação da carteira em planilha (CSV): fica para depois (Q-11). | rationale: O dono pediu para seguir com as recomendações ("pode prosseguir com o recomendado que você adicionou", 2026-10-24).
- F12 [structured_selection] open-questions: consultor-digita — O consultor digita | rationale: O dono pediu para seguir com as recomendações ("pode prosseguir com o recomendado que você adicionou", 2026-10-24).
- F13 [legacy_recommendation] context: legacy-recommendation — Antes de o @product começar esta feature, rodar o @qa em diagnostico-maturidade e fechar a feature (feature:close). Assim a nova entrega parte de uma base verificada e o workflow não mistura as duas. | rationale: O dono pediu para seguir com as recomendações ("pode prosseguir com o recomendado que você adicionou", 2026-10-24).
- F14 [structured_selection] themes: identity-references — A identidade que o FitPulse já usa | rationale: O dono pediu para seguir com as recomendações ("pode prosseguir com o recomendado que você adicionou", 2026-10-24).

## Approved Source References

- .aioson/briefings/relatorios-e-acompanhamento/briefings.md
- shared/content/questionBank.ts
- .aioson/context/prd-diagnostico-maturidade.md
- shared/domain/actionPlan.ts
- shared/domain/types.ts
- shared/domain/unitEconomics.ts
- shared/content/calculatorOptions.ts
- server/services/reportService.ts
- .aioson/docs/integrations/platform-architecture.md
- server/validation/backupSchemas.ts
- prisma/schema.prisma
- .aioson/briefings/diagnostico-maturidade/identity.md
- server/services/historyService.ts
- shared/domain/compareDiagnoses.ts
- .aioson/context/execution-state-diagnostico-maturidade.json
- .aioson/context/features.md
- src/styles/tokens.css

## Findings

- F1 [pending-decision/high/blocking] (accepted) proposed-solution: A frente 5 (questionário à distância) tem três formas possíveis, e cada uma muda o que será construído. A forma B (arquivo HTML) tem um problema no celular: o visualizador do iPhone e alguns visualizadores do WhatsApp abrem o HTML sem rodar o formulário, e gravar o arquivo de respostas no celular é instável (R-4, Q-10). O questionário atual tem 8 blocos, ajuda por pergunta, "não sei" e a calculadora de custo por cliente (shared/content/questionBank.ts, src/features/diagnosis/CalculatorBlock.tsx); tudo isso precisaria ir junto no arquivo.
- F2 [pending-decision/high/blocking] (accepted) risks: Dois campos novos mexem com dados de pessoas: o contato de quem entrega (na marca do PDF) e o responsável por cada ação. A primeira versão decidiu guardar só dados da empresa, por cuidado com a LGPD (PRD diagnostico-maturidade, Out of scope: "Dados pessoais de contato"). O contato de quem entrega é do próprio usuário do app, que digita o que quiser mostrar. Já o responsável pela ação seria o nome de outra pessoa, como um funcionário do cliente.
- F3 [gap/high/blocking] (accepted) proposed-solution: O briefing não diz o que acontece com as ações quando a empresa conclui um diagnóstico novo. Hoje, cada diagnóstico gera 3 ações a partir de um catálogo fixo (shared/domain/actionPlan.ts, buildActionPlan; tipo ActionKey em shared/domain/types.ts:153), então a mesma ação pode reaparecer no diagnóstico seguinte. Sem essa regra, o app pode mostrar duas vezes a mesma ação, uma "feita" e outra "a fazer", ou perder o andamento.
- F4 [pending-decision/medium] (accepted) open-questions: Q-8: o diário só tem valor se preencher o próximo diagnóstico com números "medidos". Hoje, o custo por cliente só sai "medido" quando o gasto e os clientes novos são valores exatos; faixas viram "estimado" (shared/domain/unitEconomics.ts:63-93). Falta decidir quantos meses de diário bastam para contar como medido.
- F5 [gap/medium] (accepted) proposed-solution: O briefing descreve o diário com um único campo de gasto. A calculadora atual pede o gasto em 6 partes (anúncios, agência, comissões, descontos, parte do salário e ferramentas; shared/content/calculatorOptions.ts, SPEND_PART_OPTIONS). Se o diário guardar só o total, o próximo diagnóstico não consegue preencher as partes e o usuário redigita.
- F6 [gap/medium] (accepted) identified-gaps: Q-3 e Q-5 podem ser respondidas pelo próprio projeto. (1) O backend do app roda no computador do usuário, então consegue abrir o PDF e a pasta pelo sistema operacional (Windows, macOS e Linux têm comando próprio para isso). As docs do Play não oferecem um diálogo de "salvar como" (.aioson/docs/integrations/). (2) As docs do Play não têm canal de aviso do app para o sistema operacional: as notificações do Play vêm do aioson.com (.aioson/docs/integrations/platform-architecture.md §3.5).
- F7 [risk/medium] (accepted) themes: A logo vai para a cópia de segurança, que tem limite de 10 MB (server/validation/backupSchemas.ts:12). As preferências hoje são pares de texto (model Preference em prisma/schema.prisma). Uma logo grande pode estourar o limite ou deixar o PDF pesado.
- F8 [scope-suggestion/low] (accepted) proposed-solution: A marca inclui uma "cor de destaque opcional". O app segue a identidade Tinta & Ouro, em que cada app tem um metal próprio (no FitPulse, o bronze antigo). Uma cor qualquer escolhida pelo usuário pode ficar ilegível no papel ou brigar com a identidade.
- F9 [risk/medium] (accepted) proposed-solution: O relatório de evolução repete o que a tela de comparação já faz, inclusive recalcular o diagnóstico anterior quando as regras mudaram (RULE-dm-11 / decisão F10; server/services/historyService.ts compare, shared/domain/compareDiagnoses.ts). Se o PDF fizer a conta por outro caminho, a tela e o PDF podem mostrar números diferentes.
- F10 [pending-decision/medium] (accepted) open-questions: Q-1: as quatro frentes juntas são uma entrega grande (a classificação da CLI deu MEDIUM, com 4 fronteiras de runtime e 9 módulos). O pedido original era o PDF. Detalhe: o relatório da carteira mostraria "ações vencidas", que só existem depois da fatia 2.
- F11 [ambiguity/low] (accepted) open-questions: Q-2, Q-4, Q-7 e Q-11 são detalhes em que o briefing já tem uma recomendação clara; dá para fechar todos de uma vez.
- F12 [pending-decision/low] (accepted) open-questions: Q-14: no modo consultoria, o diário de números é do cliente, mas quem usa o app é o consultor.
- F13 [risk/medium] (accepted) context: Q-12: a execução da primeira versão terminou em 2026-10-23 (.aioson/context/execution-state-diagnostico-maturidade.json, status completed), mas o workflow ainda aponta "next: dev" para diagnostico-maturidade. Também não existe qa-report e features.md ainda mostra in_progress. A nova feature vai construir em cima de uma base que não teve o QA final registrado.
- F14 [pending-decision/low] (accepted) themes: As telas novas (central de relatórios, acompanhamento das ações, diário, marca em Configurações) precisam de um protótipo antes da aprovação. Este briefing ainda não tem identidade visual própria. O FitPulse já tem uma identidade aprovada e implementada: Tinta & Ouro com o metal bronze antigo (.aioson/briefings/diagnostico-maturidade/identity.md, src/styles/tokens.css).

## Applied Changes

- context: text changed
- proposed-solution: text changed
- themes: text changed
- risks: text changed
- identified-gaps: text changed
- open-questions: text changed

## Skipped Changes

- None

## Unresolved Comments

- None

## Blocking Items

- None
