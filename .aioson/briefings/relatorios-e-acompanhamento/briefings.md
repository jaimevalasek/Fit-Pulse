---
slug: relatorios-e-acompanhamento
created_at: 2026-10-24
updated_at: 2026-10-24
source_plans: ["conversational"]
---

# Briefing — Relatórios profissionais e acompanhamento entre diagnósticos (FitPulse)

## Context

**Origem.** Depois de usar a primeira versão do FitPulse, o dono escreveu em 2026-10-24: "o sistema ficou bom, mas acho que faltou coisas, tipo exportar relatórios em PDF e poderia avaliar sobre melhorias que daria para fazer ficar mais profissional e mais eficaz?" (`SRC-001`).

**O que já existe (inspecionado em 2026-10-24, app rodando no preview do Play):**

| Área | Situação | Evidência |
|---|---|---|
| PDF | **Existe, mas passa despercebido.** O botão "Exportar PDF" fica só na tela de resultado de um diagnóstico. O PDF vai direto para a pasta Downloads: não abre, não pergunta onde salvar e o aviso sai em letra pequena. Não há nenhum PDF do FitPulse na pasta Downloads do dono, o que sugere que ele nunca encontrou o botão | `src/features/result/ExportReportDialog.tsx:96-146`, `server/services/reportService.ts:47-86` |
| Conteúdo do PDF | 3 páginas, só texto e barras: estágio, 3 ações, notas das 8 dimensões, números, riscos e confiança. Faltam capa, resumo executivo, gráfico, matriz de riscos visual, evolução, explicação do método e a marca de quem entrega | `server/report/pdfRenderer.ts:212-286`, amostra gerada fora da pasta Downloads |
| Outros relatórios | Não existem relatório de evolução nem da carteira de empresas. A comparação existe só como tela | `src/features/history/ComparePage.tsx`, `server/routes/reportRoutes.ts` (uma única rota) |
| Ações | O plano mostra 3 ações, mas não dá para marcar o que foi feito, pôr prazo ou responsável | `src/features/result/ActionPlanList.tsx`; PRD anterior, `CAP-dm-action-tracking` = deferred |
| Lembrete | A tela inicial do consultor já mostra "empresas sem diagnóstico há mais de 90 dias". O dono vê só "Refazer a cada 3 meses…", sem contagem nem aviso | `src/features/home/ConsultantHome.tsx`, captura da tela inicial |
| Números | O número central do método, quanto custa conquistar um cliente, aparece "não calculado" quando o dono não sabe o gasto ou os clientes novos. A primeira ação recomendada é anotar isso por 30 dias, mas o app não tem onde anotar | Tela de resultado da empresa "Aioson"; `shared/domain/unitEconomics.ts` |
| Questionário à distância | Não existe; estava deferido no PRD anterior | PRD anterior, `CAP-dm-file-bridge` = deferred |

**Escolhas do dono nesta sessão (2026-10-24, perguntas estruturadas):**
- Entram as quatro frentes: **relatórios completos**, **acompanhar as ações**, **diário de números** e **questionário à distância**.
- O PDF sai **com a marca de quem entrega**: nome, logo e contato configuráveis; o dono pode deixar em branco.
- Pasta do briefing: `relatorios-e-acompanhamento`.

**Mudança de decisões anteriores.** No PRD `diagnostico-maturidade` ficaram fora do V1, e agora entram por escolha do dono:
- a troca de respostas por arquivo;
- marcar ações e o lembrete de reavaliação;
- o check-in mensal de números ("Option C" do briefing anterior);
- a marca do consultor no PDF.

Continuam fora:
- o plano escrito por IA (só depois da calibração das regras);
- o benchmark entre empresas (exige nuvem).

**Estado do workflow.** A feature `diagnostico-maturidade` ainda consta como `in_progress` em `.aioson/context/features.md`. A execução terminou em 2026-10-23, mas o QA final não foi registrado. Esta é uma feature nova, que depende dela e não a substitui. Decidido no refinamento (F13): rodar o @qa em `diagnostico-maturidade` e fechar a feature (`feature:close`) antes de o @product começar esta.

**Decisões do refinamento (rodada 1, 2026-10-24).** O dono aceitou todas as recomendações:

| Achado | Decisão |
|---|---|
| F1 | Questionário à distância: arquivo que abre no navegador do **computador** |
| F2 | Contato só do próprio usuário na marca; responsável pela ação escolhido por papel, sem nome de pessoa |
| F3 | Diagnóstico novo traz plano novo; a ação que se repete herda o andamento; as outras ficam "encerradas" no histórico |
| F4 | Diário: 3 meses ou mais contam como medido |
| F5 | Diário nas mesmas 6 partes de gasto da calculadora, com atalho "só sei o total" |
| F6 | PDF continua na pasta Downloads, com "Abrir PDF" e "Mostrar na pasta"; lembretes só dentro do app |
| F7 | Logo PNG ou JPG até 2 MB, reduzida para no máximo 600 px; entra na cópia de segurança |
| F8 | Sem cor de destaque personalizada |
| F9 | Relatório de evolução usa o mesmo cálculo da tela de comparação |
| F10 | Um PRD, executado em 3 partes |
| F11 | Respostas no PDF: opção desligada por padrão; gráfico em barras; só as 3 ações; CSV da carteira fica para depois |
| F12 | No modo consultoria, o consultor digita o diário do cliente |
| F13 | QA e fechamento de `diagnostico-maturidade` antes do @product |
| F14 | Telas novas seguem a identidade já aprovada do FitPulse |

## Problem

**Dono de pequena empresa.**
- **Quando** termina o diagnóstico e quer mostrar o resultado a um sócio, ao contador ou a um banco, **quero** um documento que pareça sério e se explique sozinho, **para** ser levado a sério sem precisar abrir o app na frente dos outros.
- Hoje, o botão de PDF fica escondido, o arquivo some na pasta Downloads e o documento é uma lista de texto sem resumo nem gráfico.

**Quando** sai do diagnóstico com 3 ações e o número de custo por cliente "não calculado"…
- **quero** ser lembrado do que combinei fazer e ter onde anotar gasto e clientes novos mês a mês;
- **para** chegar ao próximo diagnóstico com números medidos e ver se as ações funcionaram.

Hoje, o app só serve no dia do diagnóstico:
- as ações não têm prazo nem estado;
- nada lembra de refazer o diagnóstico;
- os números continuam desconhecidos 3 meses depois.

Com isso, o próximo diagnóstico repete a mesma trava e o método perde credibilidade.

**Consultor.**
- **Quando** entrega o diagnóstico a um cliente, **quero** um relatório com a minha marca, a evolução desde a última visita e o andamento das ações, **para** justificar o meu trabalho e manter o cliente.
- **Quando** o cliente está longe, **quero** que ele responda o questionário sem eu estar junto, **para** não perder uma reunião só com perguntas.
- Hoje, o consultor:
  - entrega um PDF com a marca FitPulse;
  - não tem relatório de evolução nem visão da carteira em PDF;
  - precisa preencher o questionário junto com o cliente.

**Custo de não fazer.** O FitPulse fica igual aos diagnósticos de disparo único que o PRD anterior quis superar (`researchs/ferramentas-diagnostico-mercado/summary.md` §1.4). É um retrato bonito, não uma ferramenta de acompanhamento.

## Proposed solution

A direção foi fixada pelo dono: as quatro frentes, com a marca de quem entrega. As formas abaixo incorporam as decisões do refinamento (F1 a F14, ver `## Context`). O escopo final é do @product.

**1. Central de relatórios e PDF profissional**
- **Onde encontrar:**
  - um botão "Relatórios" na página da empresa e no resultado;
  - no modo consultoria, também na tela inicial.
  - O botão "Exportar PDF" continua no resultado.
- **Relatório do diagnóstico, em versão nova:**
  - capa com a marca de quem entrega, a empresa e a data;
  - resumo executivo de 1 página: estágio, trava, 3 ações e o número-chave;
  - gráfico das 8 dimensões em barras agrupadas por encaixes e frentes, com o número escrito, legível impresso em preto e branco (F11);
  - matriz de riscos 5×5 desenhada;
  - números com explicação;
  - andamento das ações, quando houver acompanhamento;
  - apêndice "Como ler este relatório", com o método em linguagem simples;
  - apêndice com as respostas do questionário: opção na hora de exportar, desligada por padrão, porque as respostas trazem valores em reais (F11).
- **Relatório de evolução:**
  - compara dois diagnósticos da mesma empresa: estágio antes e depois, diferença por dimensão e ações concluídas no período;
  - quando houver diário, mostra a curva do custo por cliente;
  - usa o mesmo cálculo da tela de comparação, inclusive o recálculo do diagnóstico anterior quando as regras mudaram, e só fica disponível quando a comparação também está: 2 diagnósticos concluídos da mesma empresa (F9).
- **Relatório da carteira** (modo consultoria):
  - empresas por estágio, data do último diagnóstico, atrasadas para reavaliação e risco alto;
  - "ações vencidas" entra quando a parte 2 for entregue (F10);
  - exportação em planilha (CSV) fica para depois (F11).
- **Depois de salvar:**
  - o PDF continua salvo na pasta Downloads;
  - botões "Abrir PDF" e "Mostrar na pasta": o backend do app abre o arquivo pelo sistema operacional;
  - não há "escolher a pasta", porque o Play não oferece diálogo de "salvar como" (F6).
- **Alternativa considerada:** gerar o PDF pelo "Imprimir" do navegador, a partir de uma página HTML.
  - Ganho: o layout é mais fácil de fazer.
  - Problema: depende do diálogo de impressão do webview do Play, que não foi verificado.
  - Recomendação: manter o gerador atual no servidor (`pdfkit`), que já tem fontes, quebra de página e testes.

**2. Marca de quem entrega**
- Em Configurações → "Seus relatórios": nome de quem entrega, logo (PNG ou JPG de até 2 MB, reduzida para no máximo 600 px) e o contato do próprio usuário: telefone, e-mail ou site (F2, F7).
- Sem cor de destaque personalizada: o PDF mantém as cores do FitPulse (F8).
- Tudo em branco significa a marca FitPulse.
- A marca entra:
  - na capa e no rodapé dos PDFs;
  - na cópia de segurança, para não se perder ao trocar de computador.

**3. Acompanhamento das ações**
- Cada ação do plano de um diagnóstico concluído ganha:
  - estado: a fazer, em andamento, feita ou não se aplica;
  - prazo;
  - responsável, escolhido numa lista de papéis: dono, equipe de vendas, equipe de marketing, consultor ou outro, sem nome de pessoa (F2);
  - nota.
- O resultado do diagnóstico continua imutável. O andamento é um registro separado, ligado ao diagnóstico.
- **Quando sai um diagnóstico novo (F3):**
  - vem o plano novo, com as 3 ações dele;
  - a ação que se repete (mesma ação do catálogo, `shared/domain/actionPlan.ts`) herda estado, prazo, responsável e nota;
  - as ações do plano anterior que não se repetem ficam no histórico daquele diagnóstico como "encerradas", com o estado em que estavam.
- **Tela inicial do dono:** ações vencidas e "faltam N dias para refazer o diagnóstico". O intervalo é configurável, com 90 dias como padrão.
- **Tela inicial do consultor:** ganha "ações vencidas" na carteira.
- O lembrete aparece só dentro do app, na tela inicial. O Play não oferece aviso do sistema operacional para apps (F6).
- Só as 3 ações do plano, cada uma com nota livre. Ações próprias ficam fora desta versão (F11).

**4. Diário de números**
- Por empresa, um registro por mês:
  - gasto para atrair clientes, nas mesmas 6 partes da calculadora (anúncios, agência ou freelancer, comissões, descontos e brindes, parte do salário, ferramentas), com o atalho "só sei o total" (F5);
  - clientes novos;
  - opcional: origem dos clientes (por canal), que conversa com a ação "Anotar a origem de cada cliente".
- **O app mostra:**
  - o custo por cliente de cada mês;
  - a tendência;
  - o aviso "faltam N meses para ter um número medido".
- **No próximo diagnóstico:**
  - com 3 meses ou mais anotados, o bloco "Seus números" já vem preenchido com a média dos 3 últimos e marcado como **medido** (F4);
  - com 1 ou 2 meses, o valor aparece como sugestão, ainda marcado como estimado;
  - o preenchimento mostra a origem ("do diário: média de 3 meses") e o usuário pode corrigir antes de concluir (F5).
- **Modo consultoria:** o consultor digita os meses do cliente (F12).
- **Alternativa considerada:** importar planilha.
  - Recomendação: não importar no começo, porque o público é leigo e o formato da planilha varia.

**5. Questionário à distância**
- **Forma escolhida (B, F1): arquivo que abre no navegador do computador.**
  1. O consultor gera um **arquivo de questionário** da empresa: um HTML único, que abre em qualquer navegador sem instalar nada.
  2. O cliente abre o arquivo no navegador do **computador** e responde com a mesma ajuda, a mesma opção "não sei" e a calculadora. A mensagem ao cliente diz "abra no computador", porque no celular o formulário não roda de forma confiável.
  3. Ao terminar, o HTML gera um **arquivo de respostas**, que o cliente devolve por WhatsApp ou e-mail. O app não envia nada.
  4. O consultor importa o arquivo, que vira um rascunho da empresa para revisar e concluir.
- **Alternativas consideradas:**
  - (A) O cliente instala o Play e o FitPulse e exporta as respostas. É mais simples de construir, mas exige instalação do cliente, que é leigo.
  - (C) Questionário em PDF para imprimir, com o consultor digitando as respostas. Não precisa de tecnologia nenhuma, mas é trabalho manual e tem erro de digitação.
- Escolhida pelo dono em F1. Antes de construir, testar a abertura em Chrome, Edge e Safari (Q-10). Os riscos de B estão em `## Risks`.

**6. Acabamento** (defeitos vistos na inspeção, independentes das frentes acima)
- "1 de 26 item sem o número" → "itens".
- Na lista de riscos da tela de resultado, "Probabilidade 4 de 5" quebra em várias linhas na coluna estreita.
- O botão "Exportar PDF" precisa de mais destaque e de uma confirmação visível de onde o arquivo foi parar.

**Fatiamento decidido (F10):** um único PRD, executado nesta ordem:

| Fatia | Conteúdo |
|---|---|
| 1 | Relatórios + marca + acabamento |
| 2 | Acompanhamento das ações + diário de números |
| 3 | Questionário à distância |

Cada fatia é utilizável sozinha.

## Themes

| Tema | O que muda para o usuário | Objetos novos ou alterados | Gerenciamento necessário |
|---|---|---|---|
| T1 Relatórios | Encontrar, gerar e abrir 3 tipos de PDF profissionais | Nenhum objeto persistido: o PDF é gerado e salvo em arquivo. Opções de exportação (incluir respostas? incluir evolução?) | Escolher o tipo, as opções e o diagnóstico ou o par a comparar. Falha de gravação, como hoje, não altera nada. Estados vazios: sem diagnóstico concluído não há relatório; a evolução exige 2 concluídos da mesma empresa; a carteira só existe no modo consultoria e explica isso quando a carteira está vazia |
| T2 Marca | O PDF sai com a identidade de quem entrega | Preferência de marca (nome, logo, contato do próprio usuário; sem cor) | Criar, editar e remover a logo; voltar ao padrão; entrar na cópia de segurança; validar formato e tamanho da imagem |
| T3 Ações | Saber o que fazer, até quando, e o que já foi feito | Andamento de cada ação (estado, prazo, responsável por papel, nota), ligado a um diagnóstico concluído e imutável e herdado quando a ação se repete no diagnóstico seguinte; intervalo de reavaliação | Listar por empresa e na tela inicial, editar o estado, filtrar vencidas, arquivar junto com o diagnóstico ou a empresa; cópia de segurança |
| T4 Diário | Ter números medidos antes do próximo diagnóstico | Registro mensal por empresa, nas 6 partes de gasto da calculadora + clientes novos | Criar, editar e excluir um mês; estado vazio que explica por que anotar; evitar mês duplicado; usar no preenchimento do próximo diagnóstico; cópia de segurança |
| T5 Questionário à distância | O cliente responde sem o consultor | Arquivo de questionário (saída) e arquivo de respostas (entrada) → rascunho | Gerar, importar, recusar arquivo de outra empresa, de versão de regras incompatível ou corrompido; mostrar de onde veio o rascunho |
| T6 Acabamento | Texto e layout corretos | — | — |

**Identidade visual (F14):** as telas novas seguem a identidade já aprovada e implementada do FitPulse (Tinta & Ouro, metal bronze antigo; `.aioson/briefings/diagnostico-maturidade/identity.md`, `src/styles/tokens.css`).

**Impactos transversais:**
- novas tabelas e migração (`compatibility.schema_version` passa de 1 para 2; migração versionada, nunca `db push`);
- cópia de segurança com nova versão de formato, que continua importando arquivos da versão 1;
- `GET /api/aioson-play` atualizado só se surgirem rotas expostas ao Play;
- testes de PDF (hoje existe `tests/e2e/report.spec.ts` e `unpdf` nos devDependencies).

## Risks

| # | Risco | Tipo | Efeito | Mitigação proposta |
|---|---|---|---|---|
| R-1 | Escopo grande: quatro frentes com objetos novos, migração e PDF | Viabilidade | Entrega longa; a fatia 1, que o dono pediu primeiro, atrasa | Fatiar (1 → 2 → 3); o @product pode aprovar todas e o @planner executar por fases |
| R-2 | Conflito com a decisão de LGPD do PRD anterior ("o V1 guarda só dados da empresa", sem nome, e-mail ou telefone de pessoas). Marca, contato do consultor e "responsável" pela ação introduzem dados de pessoas | Conformidade | Retrabalho ou questão legal | Decidido (F2): contato só do próprio usuário; responsável escolhido por papel, sem nome de pessoa. O app continua sem guardar dados de terceiros |
| R-3 | A regra "resultado imutável depois de concluído" pode ser quebrada se o andamento das ações for gravado dentro do resultado | Integridade | Comparações e PDFs antigos mudam sem querer | Andamento em tabela própria; o resultado nunca é reescrito |
| R-4 | Questionário em HTML (forma B): e-mail e antivírus podem bloquear um `.html` com script anexado; arquivo adulterado; regras do questionário mudam entre gerar e importar | Viabilidade, segurança | O cliente não consegue abrir ou o consultor importa dados errados | Forma B restrita ao navegador do computador (F1). Validar o arquivo de respostas por esquema (zod) e pela versão das regras; recusar sem alterar nada; testar em Chrome, Edge e Safari, e o envio por Gmail, Outlook e WhatsApp (Q-10) |
| R-5 | Logo enviada pelo usuário: imagem grande, formato estranho, SVG com script | Segurança, robustez | PDF pesado ou falha | Decidido (F7): só PNG ou JPG até 2 MB, reduzida para no máximo 600 px; recusar o resto com mensagem clara |
| R-6 | Webview do Play: abrir o PDF ou a pasta, ou escolher onde salvar, pode não funcionar | Viabilidade | "Abrir PDF" não faz nada | Resolvido (F6): o backend abre o arquivo e a pasta pelo sistema operacional; sem "escolher a pasta"; manter a mensagem de onde salvou |
| R-7 | O dono pode não criar o hábito de anotar números todo mês | Valor | Diário vazio; o custo por cliente continua não calculado | Lembrete mensal na tela inicial; registro em 2 campos; mostrar o ganho ("com 3 meses anotados, o app calcula o seu custo por cliente") |
| R-8 | Gráficos desenhados à mão no `pdfkit` (radar, matriz) podem ficar ilegíveis em impressão preto e branco | Usabilidade | Relatório menos profissional | Barras com rótulos e números sempre visíveis; testar a impressão em escala de cinza |
| R-9 | O diário preencher o diagnóstico seguinte muda a confiança e o estágio | Integridade | O usuário não entende por que o estágio mudou | Mostrar a origem ("do diário: média de 3 meses") e permitir corrigir antes de concluir |
| R-10 | A cópia de segurança da versão 2 não pode quebrar a importação de arquivos da versão 1 | Compatibilidade | Perda de dados ao trocar de computador | Importador aceita v1 e v2; v2 recusada por app antigo (já é o comportamento) |
| R-11 | A herança de andamento entre diagnósticos (F3) pode duplicar ou perder uma ação se a regra de "mesma ação" não for exata | Integridade | Ação aparece duas vezes ou perde o estado | Comparar pela chave da ação do catálogo (`ActionKey`); teste dedicado para ação repetida, nova e encerrada |
| R-12 | A versão 1 não teve o QA final registrado | Qualidade | Defeitos da versão 1 aparecem durante a versão 2 | Rodar o @qa em `diagnostico-maturidade` e fechar a feature antes do @product (F13) |

## Identified gaps

| Gap | Hoje | Desejado | Delta mensurável |
|---|---|---|---|
| Descobrir o PDF | Botão só no resultado; arquivo some na pasta Downloads | Relatórios a 1 clique da página da empresa; o PDF abre depois de salvo ("Abrir PDF", "Mostrar na pasta"; F6) | Usuário novo encontra e abre um PDF em menos de 30 s (teste com usuário) |
| Qualidade do PDF | 3 páginas de texto, marca FitPulse fixa | Capa, resumo de 1 página, gráfico, matriz, método, marca de quem entrega | Resumo executivo cabe em 1 página; a marca configurada aparece na capa e no rodapé |
| Tipos de relatório | 1 (diagnóstico) | 3 (diagnóstico, evolução, carteira) | +2 relatórios |
| Vida entre diagnósticos | Nenhuma | Ações com estado e prazo, lembrete de reavaliação, diário mensal | Percentual de ações com estado definido; meses anotados por empresa |
| Custo por cliente | "não calculado" quando o dono não sabe | Calculado a partir do diário | Próximo diagnóstico com o custo marcado como "medido" depois de N meses de diário |
| Coleta à distância | Inexistente | Cliente responde sozinho; o consultor importa um rascunho | Importação de um arquivo válido gera rascunho sem redigitação |

**Lacunas de conteúdo a escrever** (rascunho pelo @product, aprovação do dono, como no F5 anterior):
- texto do apêndice "Como ler este relatório";
- textos do estado vazio do diário;
- instrução ao cliente no questionário à distância.

## Sources

Nenhuma pesquisa na web nesta sessão. A evidência está registrada em `researchs/fitpulse-avaliacao-pos-v1/summary.md` (SRC-001). A avaliação veio da inspeção do repositório e do app rodando no preview do Play (`http://localhost:3543`) em 2026-10-24:
- capturas de início, empresa e resultado;
- uma amostra do PDF atual gerada por script numa pasta temporária, sem gravar na pasta Downloads do dono.

Também foram consultados:
- o PRD anterior: `.aioson/context/prd-diagnostico-maturidade.md` (Capability Map e Out of scope);
- as docs do Play: `.aioson/docs/integrations/`, sem contrato de notificação do app para o sistema operacional nem de diálogo de salvar arquivo.

### Source Inventory

| Source | Path | Type | Role | Fingerprint | Usage | Purpose |
|---|---|---|---|---|---|---|
| SRC-001 | researchs/fitpulse-avaliacao-pos-v1/summary.md | research | intent+evidence | sha256:e5d0e17419f84b29cac9a6d86ef1847942a1d421e36ab8163723c825a98e6028 | consulted | Pedido literal do dono, as 3 escolhas estruturadas de 2026-10-24 e as constatações da inspeção do código, do app em execução e do PRD anterior |
| SRC-002 | researchs/ferramentas-diagnostico-mercado/summary.md | research | evidence | sha256:471fcee75a26487482b726f94867a5fc7ed56edaf26621a97a599ee424abe745 | consulted | §1.4: diagnósticos de mercado são de disparo único e quase nenhum acompanha a evolução |

### Source Promise Map

| PROM | Source | Locator | Approved intent | State |
|---|---|---|---|---|
| PROM-001 | SRC-001 | §1, "exportar relatórios em PDF" | Exportar relatórios em PDF que o usuário encontre e use | required |
| PROM-002 | SRC-001 | §1, "ficar mais profissional" | Melhorias que deixem o app e as entregas mais profissionais | required |
| PROM-003 | SRC-001 | §1, "e mais eficaz" | Melhorias que façam o diagnóstico gerar resultado de fato | required |
| PROM-004 | SRC-001 | §2 "Quais melhorias entram": Relatórios completos | PDF profissional + relatório de evolução + relatório da carteira + abrir o PDF depois de salvar | required |
| PROM-005 | SRC-001 | §2 "Quais melhorias entram": Acompanhar as ações | Marcar ações, prazo, responsável e lembrete de refazer em 90 dias | required |
| PROM-006 | SRC-001 | §2 "Quais melhorias entram": Diário de números | Anotar gasto e clientes novos por mês; o app calcula o custo por cliente | required |
| PROM-007 | SRC-001 | §2 "Quais melhorias entram": Questionário à distância | O cliente responde longe do consultor e o consultor importa as respostas | required |
| PROM-008 | SRC-001 | §2 "Quem entrega o PDF" | Nome, logo e contato de quem entrega na capa e no rodapé; em branco significa FitPulse | required |
| PROM-009 | SRC-001 | §3.6, CAP-dm-ai-plan | Plano escrito por IA | deferred |
| PROM-010 | SRC-001 | §3.6, CAP-dm-benchmark | Comparar com empresas do mesmo segmento | not_applicable |

## Open questions

1. **Q-1 [decision-required]** Fatiar a entrega em 3 partes (relatórios + marca → ações + diário → questionário à distância) ou entregar tudo de uma vez? Recomendado: fatiar, porque o pedido original foi o PDF. **Resolvida (F10): um PRD, executado em 3 partes.**
2. **Q-2 [decision-required]** O apêndice com as respostas do questionário entra no PDF sempre, nunca ou como opção na hora de exportar? Recomendado: opção, desligada por padrão, porque as respostas trazem valores em reais. **Resolvida (F11): opção na hora de exportar, desligada por padrão.**
3. **Q-3 [research-able]** O webview do Play permite abrir um arquivo ou uma pasta pelo backend do app (`start`, `open`, `xdg-open`) e oferece algum diálogo de "salvar como"? Define se existem os botões "Abrir PDF" e "Escolher pasta". **Resolvida (F6): o backend abre o PDF e a pasta pelo sistema operacional; sem "salvar como".**
4. **Q-4 [decision-required]** Gráfico das 8 dimensões no PDF: radar (mais "consultoria") ou barras agrupadas (mais legível impresso)? Recomendado: barras, pelo R-8. **Resolvida (F11): barras agrupadas.**
5. **Q-5 [research-able]** O Play oferece algum canal de aviso ao usuário fora da janela do app? Se não, o lembrete fica só na tela inicial. **Resolvida (F6): não há canal; lembrete só dentro do app.**
6. **Q-6 [decision-required]** Aceitar dados de pessoas (contato do consultor, responsável pela ação), revertendo a regra de coleta mínima do PRD anterior? Recomendado: sim, como texto livre e opcional, com exclusão junto com a empresa e na cópia de segurança. **Resolvida (F2): contato só do próprio usuário; responsável por papel.**
7. **Q-7 [decision-required]** Permitir que o usuário acrescente ações próprias além das 3 do plano? **Resolvida (F11): só as 3 ações, com nota livre.**
8. **Q-8 [decision-required]** Quantos meses de diário bastam para o custo por cliente contar como "medido" no próximo diagnóstico (1, 2 ou 3)? Depende de como as regras atuais classificam "medido" × "estimado" (`shared/domain/unitEconomics.ts`, `confidence.ts`). **Resolvida (F4): 3 meses.**
9. **Q-9 [decision-required]** Forma do questionário à distância: B (arquivo HTML que abre no navegador), A (cliente instala o Play) ou C (PDF para imprimir)? Recomendado: B. **Resolvida (F1): forma B, no navegador do computador.**
10. **Q-10 [testable]** Um `.html` com script enviado por Gmail, Outlook e WhatsApp chega e abre no celular e no computador do cliente? **Fazer antes de construir a parte 3 (forma B escolhida em F1).**
11. **Q-11 [decision-required]** O relatório da carteira deve ter também uma exportação em planilha (CSV) para quem gosta de Excel? **Resolvida (F11): fica para depois.**
12. **Q-12 [decision-required]** Encerrar formalmente a feature `diagnostico-maturidade`, que ainda está `in_progress`, antes de o @product começar esta, ou trabalhar em paralelo? **Resolvida (F13): QA e fechamento de `diagnostico-maturidade` antes do @product.**
13. **Q-13 [out-of-scope]** Plano de ação escrito por IA e benchmark entre empresas continuam fora (PROM-009, PROM-010).
14. **Q-14 [decision-required]** No modo consultoria, quem preenche o diário de números do cliente? O consultor digita, ou o arquivo do questionário à distância também leva e traz os meses do diário? Recomendado: o consultor digita no começo; o envio pelo arquivo fica como extensão da forma B. **Resolvida (F12): o consultor digita.**
