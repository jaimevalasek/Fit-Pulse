---
feature: relatorios-e-acompanhamento
status: approved
identity: .aioson/briefings/relatorios-e-acompanhamento/identity.md
references: extracted
surface_mode: operate
design_skill: interface-design (default)
approved_at: 2026-10-25T01:08:26.736Z
---

# Prototype manifest — Relatórios e acompanhamento (FitPulse)

> Protótipo **somente de demonstração**. Os dados ficam em memória: atualizar a página volta ao estado inicial. Não há backend, banco nem geração real de PDF; a prévia em papel desenha no navegador o conteúdo que o PDF vai ter.

Arquivo: `.aioson/briefings/relatorios-e-acompanhamento/prototype.html` (HTML único, rotas por hash).

## Visual direction

- register: Quiet. As telas são de operação, com escala fixa, um só metal (bronze antigo) e movimento só de estado. A prévia do relatório é a única superfície "de papel".
- thesis: o relatório que se explica sozinho e o acompanhamento que vive entre um diagnóstico e outro. A tinta é o app; a porcelana é o papel que sai dele, com a marca de quem entrega na capa.
- anti-goals:
  - PDF com cara de painel de BI: gráficos coloridos, pizza, glow;
  - diário com cara de planilha genérica;
  - acompanhamento com cara de gerenciador de tarefas (kanban, listas infinitas);
  - os mesmos do FitPulse: fundo azulado, ouro como cor de produto, serif na máquina ou mono na intenção.
- signature move: a folha de porcelana montada ao vivo sobre a tinta. Tudo o que o usuário escolhe à esquerda (tipo, diagnóstico, respostas, marca) muda a página na hora, e a capa leva o nome e a logo de quem entrega.
- composition signature: duas colunas na central de relatórios: à esquerda o que o relatório leva, à direita a folha paginada; nas abas de ações e diário, linhas sobre fios finos com a data e os números em mono.
- composition family: framed-plate adaptado como folha de papel sobre a tinta
- material family: tinta quente com fios finos e troca tonal de slot; papel porcelana com a sua própria paleta fixa (bronze escuro, cobre e perigo do tema claro)
- motion family: feedback de estado de 160 a 220 ms; a página nova da prévia entra com fade de 220 ms; prefers-reduced-motion deixa tudo estático

## Design system decision

- **Choice:** `reuse`. Reaproveita a identidade aprovada e implementada do FitPulse.
- **Authorization:** decisão F14 do refinamento (rodada 1, 2026-10-24), opção `identity-references`, aceita quando o dono pediu para seguir com as recomendações: "pode prosseguir com o recomendado que você adicionou".
- **Scope:** este briefing (`scope: briefing`). É a cópia de `.aioson/briefings/diagnostico-maturidade/identity.md`, com as mesmas referências e os mesmos SHA-256 em `references/identity/`.
- **Consolidation:** concluída. `verify:artifact --kind=identity` deu OK em 2026-10-24.

## Screen inventory

| Route | Screen | States demonstráveis |
|---|---|---|
| `#/empresa/c1/relatorios` | Central de relatórios da empresa: tipo (diagnóstico / evolução), opções, marca e prévia em papel paginada (foco) | populado; carregando (`?state=loading`); exportar → salvando → salvo com "Abrir PDF" e "Mostrar na pasta" (`?state=success`); falha de gravação (`?state=error`); evolução indisponível com 1 diagnóstico (`#/empresa/c2/relatorios`) |
| `#/empresa/c3/relatorios` | Relatórios sem diagnóstico concluído | vazio |
| `#/relatorios/carteira` | Relatório da carteira (modo consultoria) | populado; explicação no modo minha empresa |
| `#/inicio` (modo minha empresa) | Início: contagem para refazer o diagnóstico (foco), trava, ações do plano, diário, relatórios e as 3 ações com estado | populado; ação vencida |
| `#/inicio` (modo consultoria) | Carteira por estágio (foco), reavaliação atrasada, ações vencidas, risco alto e questionários aguardando; cada indicador abre a lista filtrada | populado |
| `#/empresas?filtro=…` | Lista de empresas com filtros por estágio e por atenção | populado; filtro sem resultado |
| `#/empresa/c1` | Página da empresa, aba Diagnósticos: linha do tempo e rascunho importado do cliente | populado; questionário enviado (`#/empresa/c3`); rascunho importado |
| `#/empresa/c1/acoes` | Aba Ações: plano atual com estado, prazo, responsável por papel e nota; ação herdada; encerradas com diagnósticos anteriores | populado; vencida; vazio sem diagnóstico (`#/empresa/c3/acoes`) |
| `#/empresa/c1/diario` | Aba Diário de números: progresso até "medido", gráfico do custo por cliente e meses | populado (medido); 1 mês (`#/empresa/c2/diario`); vazio (`?state=empty`); mês duplicado e campos inválidos no formulário |
| `#/resultado/d2` | Resultado (só o que muda): "Relatórios" e "Exportar PDF" no topo; 3 ações com estado | populado; plano encerrado (`#/resultado/d1`) |
| `#/configuracoes` | Seus relatórios (marca com prévia da capa), lembrete de reavaliação, modo de uso, cópia de segurança | sem marca; com marca; logo inválida (formato e tamanho); telefone, e-mail e site inválidos |
| `#/questionario-cliente` | O que o cliente vê no arquivo do questionário à distância: aviso de computador, blocos, revisão e salvamento | respondendo; revisão; salvando; salvo |

## Core interactions

- `report-type-diagnosis`
- `report-type-evolution`
- `report-include-answers`
- `report-export-pdf`
- `report-open-pdf`
- `report-show-folder`
- `report-export-failure-retry`
- `portfolio-report`
- `brand-save`
- `brand-logo-upload`
- `brand-logo-remove`
- `brand-reset`
- `action-status-change-undo`
- `action-edit-due-role-note`
- `action-inherited-from-previous`
- `reevaluation-countdown`
- `reevaluation-interval-setting`
- `diary-add-month`
- `diary-edit-month`
- `diary-delete-month`
- `diary-total-only`
- `diary-measured-after-three-months`
- `remote-questionnaire-send`
- `remote-questionnaire-client-answer`
- `remote-questionnaire-import`
- `remote-questionnaire-import-errors`
- `remote-questionnaire-replace-draft`
- `home-widget-drilldown`
- `switch-usage-mode`
- `switch-theme`
- `tour-reopen`

## Runtime matrix

- entry: `#/empresa/c1/relatorios`
- loading: `#/empresa/c1/relatorios?state=loading`
- empty: `#/empresa/c1/diario?state=empty`
- error: `#/empresa/c1/relatorios?state=error`
- success: `#/empresa/c1/relatorios?state=success`

Permissão negada: não se aplica, porque o app não tem login nem papéis (decisão da versão 1, sem aioson-auth).

## Refinement budget

- **Choice:** refinar e preparar para aprovação.
- **Authorization:** resposta do dono em 2026-10-24: "Refinar e preparar (Recommended)".
- **Cycle budget:** 1 ciclo autorizado e **consumido** (inspeção, acabamento, medição em runtime, walkthrough de promessas e de primeiro contato). Outro ciclo exige um novo pedido do dono.

## Quality evidence

- verdict: pass
- evidence: .aioson/context/features/relatorios-e-acompanhamento/visual-evidence.json
- craft: 4/4 (operate: typeface, material, motion e chrome ativos; precision 100/100)
- runtime: measured (Playwright Chromium, desktop 1280 e mobile 360, 10 capturas da primeira dobra)
- routes: 5

### Verificações realmente executadas (ciclo de refinamento autorizado, 2026-10-24)

- **`verify:artifact --kind=visual --runtime --screenshots`:**
  - as 5 rotas da Runtime matrix (entry, loading, empty, error, success) passaram no desktop e no mobile;
  - nenhuma falha de contraste, nenhuma rolagem horizontal, e o `data-aioson-primary` aparece na primeira dobra nas duas larguras;
  - tokens 81%, profundidade só por bordas, redução de movimento efetiva e fonte entregue (Inter e JetBrains Mono via webfont; Georgia é do sistema).
- **Defeitos objetivos encontrados e corrigidos neste ciclo:**
  - no mobile, a prévia do PDF estava abaixo da primeira dobra: o topo ficou compacto e os botões encurtaram;
  - no mobile, as abas e as páginas em carrossel saíam da tela: as abas ficaram compactas e as páginas passaram a empilhar na vertical;
  - o movimento era só de estado e passou a ser desenhado:
    - entrada em sequência a cada troca de rota;
    - traço batuta sob a aba ativa;
    - páginas da prévia reveladas ao rolar;
    - poeira que deriva só no tema tinta;
  - a fonte estrutural não era reconhecida como entregue: `font-family` passou a ser explícito no corpo.
- **Walkthrough de promessas:**
  - `aioson browser:run . --script=.aioson/briefings/relatorios-e-acompanhamento/walkthrough.json --prototype` deu PASS em 107/107 passos;
  - relatório em `.aioson/briefings/relatorios-e-acompanhamento/browser/prototype-relatorios-e-acompanhamento.json`;
  - promessas provadas: PROM-001, 002, 003, 004, 005, 006, 007 e 008;
  - PROM-009 (plano por IA) está deferida e PROM-010 (benchmark) não se aplica.
- **Microinteração ligada à assinatura:**
  - ao trocar o tipo, o diagnóstico, o par da evolução ou o apêndice de respostas, a página afetada da prévia é "reimpressa": uma faixa em bronze desce pela folha em 700 ms e a prévia rola até ela;
  - tudo fica estático com `prefers-reduced-motion`.
- **Tour de primeiro uso:**
  - 5 passos em linguagem leiga, ancorados em `data-aioson-tour` (relatórios, marca, ações, diário e modo);
  - pode ser dispensado e é reaberto pelo botão "?" do topo.
- **Walkthrough de primeiro contato:** um subagente sem acesso a código nem a documentos, só ao snapshot de acessibilidade de 8 telas.
  - A primeira rodada foi descartada: a ferramenta de captura ignorou a rota e as 5 telas vieram iguais. Os pontos válidos sobre a tela de relatórios foram corrigidos:
    - botão de modo explicado;
    - versão das regras e confiança na capa;
    - regra do estágio pela dimensão mais fraca;
    - motivo de as respostas virem desligadas;
    - "Responsável:" rotulado;
    - matriz de risco com descrição acessível.
  - Na segunda rodada, com as 8 telas certas, ele descreveu o produto como "diagnóstico de crescimento de pequenos negócios, com plano de 3 ações, riscos e relatório em PDF, para o dono ou para consultores que acompanham várias empresas". Apontou como mais importante "acompanhar as 3 ações até refazer o diagnóstico". Isso bate com as promessas do briefing, e não houve achado bloqueante.
  - Pontos de confusão corrigidos no texto:
    - os dois custos por cliente agora dizem a origem (diagnóstico × diário), com a conta exata;
    - uma ação "em andamento" com prazo vencido não é mais contada duas vezes;
    - a linha do tempo diz "Último / Hoje / Próximo";
    - "Cálculo versão 1" usa o mesmo termo do app atual;
    - o rótulo da marca muda no modo minha empresa;
    - a cópia de segurança diz onde estão os botões;
    - a troca de modo diz de onde vêm as empresas.
  - Mantido de propósito: "Encaixes do negócio" e "Frentes de crescimento" são o vocabulário aprovado da versão 1 (decisão F2) e ganharam uma frase de explicação na página das dimensões e em "Como ler".

### Avisos restantes e justificativas

- **`input 40x24` no mobile:** é o interruptor "Incluir as respostas do questionário" dentro de um rótulo `.switch` de 44px de altura e largura total. O alvo de toque é o rótulo inteiro; o interruptor é só o indicador visual.
- **Repetição de paleta com outro projeto do ecossistema (matiz ~124° sobre fundo escuro):**
  - é continuidade intencional: o app segue a identidade aprovada e implementada do FitPulse (Tinta & Ouro com o bronze antigo), reaproveitada por decisão F14;
  - as telas novas precisam ficar iguais às que já existem.
- **Texto pequeno dentro da prévia em papel:** é a miniatura de uma página A4. As fontes da folha escalam com a largura (`cqw`); no PDF real, o corpo sai em tamanho de impressão.

### Limitações conhecidas

- Somente demonstração: atualizar a página volta ao estado inicial, e não há backend nem banco.
- A prévia desenha no navegador o conteúdo que o PDF vai ter; o PDF real continua gerado no servidor (`pdfkit`). "Abrir PDF", "Mostrar na pasta" e a gravação em Downloads são simulados.
- A escolha de arquivo de respostas usa uma lista de exemplos (só no protótipo). A logo aceita um arquivo real do computador e também tem botões de exemplo.
- O questionário do cliente mostra 1 pergunta por bloco; o arquivo real leva todas as perguntas.
- No modo minha empresa, a base de demonstração ainda contém as outras empresas da consultoria (aparecem ao trocar o modo).
- As máscaras aceitam digitação só no fim do campo, como no protótipo da versão 1.
