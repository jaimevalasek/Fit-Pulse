---
feature: diagnostico-maturidade
status: approved
identity: .aioson/briefings/diagnostico-maturidade/identity.md
references: extracted
surface_mode: operate
design_skill: interface-design (default)
approved_at: 2026-10-22T21:56:16.441Z
---

# Prototype manifest — Diagnóstico de maturidade (FitPulse)

> Protótipo **somente de demonstração**: dados em memória, atualizar a página volta ao estado inicial, sem backend, sem banco e sem cálculo calibrado. As regras de estágio, notas e riscos são de **demonstração** (não são o conteúdo metodológico v1, que o @product rascunha e o dono aprova, decisão F5).

Arquivo: `.aioson/briefings/diagnostico-maturidade/prototype.html` (HTML único, rotas por hash).

## Visual direction

- register: Quiet (as superfícies de operação ganham familiaridade, com escala fixa, um só metal e movimento de estado; o resultado é uma superfície de decisão com tipografia de exibição)
- thesis: um check-up calmo vestido de tinta e bronze, em que cada tela responde uma pergunta só e o resultado mostra em que degrau a empresa está e qual trava a segura, com a decisão em voz humana e a evidência em voz de máquina
- anti-goals: fundo azulado ou acentos frios da identidade antiga; painel de agência com glow e paredes de cartões; quiz de captação de lead com "fale com um especialista"; serif na máquina, mono na intenção ou ouro como cor de produto
- signature move: a escada com trava sobre a pauta, quatro degraus que nascem dos cinco fios com o compasso em bronze, o degrau atual em bronze, o anterior tracejado como rastro e um cadeado no próximo degrau nomeando a trava em serif itálico
- composition signature: uma prancha de quatro degraus sobre a pauta ancora cada tela de decisão, e a pauta de cinco fios separa as seções em vez de cartões
- composition family: framed-plate adaptado como prancha da escada sobre a pauta
- material family: tinta quente com poeira (nebulosa no bronze e fagulhas ouro/bronze), fios finos e troca tonal de slot, sem sombra
- motion family: state feedback de 160 a 220 ms, entrada em sequência das seções, batuta desenhada na troca de rota, poeira respirando em 8 s só no tema tinta; prefers-reduced-motion deixa tudo estático

Identidade aplicada: `.aioson/briefings/diagnostico-maturidade/identity.md` (`source: references`), extraída do design system do ecossistema fornecido pelo dono. Ela substitui a direção inicial `mono-200` do `design:seed`, que fica registrada só como histórico desta rodada.

## Design system decision

- **Choice:** `references`. Esta escolha substitui a anterior `intent` (F14).
- **Authorization:** em 2026-10-22, ao ser perguntado se aceitava a direção inicial como padrão, o dono respondeu: "Use esta direção de design \"C:\dev\aioson-com\.aioson\explorations\aioson-ecosystem-identity\runs\variant-d\design-dna\"". Depois acrescentou: "como o play tem este design system acho que pode ser uma opção boa para combinar e como será um produto do play nada mais justo do que tem um design system mais único".
- **Scope:** este briefing (`scope: briefing`). Não foi escrito `.aioson/context/identity.md` de projeto.
- **Consolidation:** concluída.
  - As referências foram copiadas para `references/identity/` com SHA-256:
    - `DESIGN-DNA.md` `2c042a6ae29eb6a77737fd03d96b0fb8ee7f8cd5d18477327c68f76bcc751eeb`
    - `tokens.css` `384861d3410acb27a4176318646d48afeff31154f18a83de1977d2b7b9565e0c`
    - `tokens.json` `2cd61b1afa029d86c322e19db122ce40c9121031dd4e4196f7d7d889333e594c`
    - `dna-demo-tinta-1440.png` `4499884220687f95702fbacd84367780ea3b93f3114ed1b18c15dd4f5c87e709`
  - O `identity.md` passou em `verify:artifact --kind=identity`.
- **Proposta para o dono confirmar:** o metal do app é o **bronze antigo** (`#a8c07a` / `#55692a`). O design system de origem permite material novo para software novo, e o bronze antigo ainda não está listado lá.

## Screen inventory

| Route | Screen | States demonstráveis |
|---|---|---|
| `#/boas-vindas` | Assistente de primeiro uso, passo 1: escolher o uso (minha empresa / consultoria) | padrão |
| `#/boas-vindas/empresa` | Assistente, passo 2: cadastro da empresa | validação inline (nome obrigatório, CNPJ opcional com dígito verificador) |
| `#/inicio` | Início, modo empresa: escada (foco), trava, próximas ações, rascunho em andamento, evolução | populado; rascunho presente |
| `#/inicio` (modo consultoria) | Início, modo consultoria: carteira por estágio (foco), rascunhos parados, sem diagnóstico há mais de 90 dias, risco alto | populado |
| `#/empresas` | Lista de empresas com busca, filtro por estágio e arquivadas | populado; vazio (`?state=empty`); busca sem resultado |
| `#/empresa/:id` | Página da empresa: dados e linha do tempo de diagnósticos | populado; vazio (`?state=empty`) |
| `#/diagnostico/:id` | Questionário guiado por blocos, com ajuda, "não sei" com faixas, salvamento automático e calculadora de CAC/LTV | rascunho; erro de campo de moeda |
| `#/resultado/:id` | Resultado em camadas: escada e trava, 3 ações, aviso; detalhe com Fits, Pilares, riscos 5×5 e confiança | calculando (`?state=loading`); populado; sem riscos altos |
| `#/comparar/:id` | Comparação com o diagnóstico anterior, incluindo recálculo por versão de regras | populado |
| `#/configuracoes` | Perfil de uso, backup (exportar e importar), limites do app, demonstração | erro de importação (`?state=error`); sucesso de exportação |

## Core interactions

- `wizard-choose-mode`
- `wizard-create-company`
- `company-create`
- `company-edit`
- `company-archive`
- `company-restore`
- `company-delete`
- `diagnosis-start-from-previous`
- `diagnosis-answer-anchored-item`
- `diagnosis-dont-know-range`
- `diagnosis-autosave-resume`
- `diagnosis-discard-draft`
- `cac-ltv-calculator`
- `diagnosis-complete`
- `result-layered-view`
- `result-compare-previous`
- `result-export-pdf`
- `backup-export`
- `backup-import`
- `switch-usage-mode`
- `tour-reopen`
- `switch-theme`

## Runtime matrix

- entry: `#/inicio`
- loading: `#/resultado/d2?state=loading`
- empty: `#/empresas?state=empty`
- error: `#/configuracoes?state=error`
- success: `#/resultado/d2`

Permissão negada: não se aplica, porque o app não tem login nem papéis (decisão sem aioson-auth).

## Refinement budget

- **Choice:** refinar e preparar para aprovação.
- **Authorization:** resposta do dono em 2026-10-22: "Refinar e preparar (Recommended)".
- **Cycle budget:** 1 ciclo autorizado e consumido (restyle pelo design system de referência, polimento, medição em runtime, walkthrough de promessas e de primeiro contato). Outro ciclo exige um novo pedido do dono.

## Quality evidence

- verdict: pass
- evidence: .aioson/context/features/diagnostico-maturidade/visual-evidence.json
- craft: 4/4 (operate: typeface, display scale, material e motion ativos)
- runtime: measured (Playwright Chromium, desktop e mobile, 10 capturas da primeira dobra)
- routes: 5

### Verificações realmente executadas (ciclo de refinamento autorizado, 2026-10-22)

- **`verify:artifact --kind=visual --runtime --screenshots`**:
  - OK nas 5 rotas da Runtime matrix (entry, loading, empty, error, success), em desktop e mobile;
  - tokens 96%, profundidade só por bordas, redução de movimento efetiva e fonte entregue (Inter + JetBrains Mono via webfont; Georgia é do sistema).
- **Defeitos objetivos encontrados e corrigidos neste ciclo:**
  - contraste 1:1 do rótulo "Você está aqui", que estava dentro do degrau em bronze: ganhou fundo próprio;
  - alvos de toque abaixo de 44px no celular (marca, botões do topo, links soltos, migalha e seleção);
  - movimento só de estado, que passou a desenhado: a poeira respira no brilho e as barras se preenchem ao entrar na tela.
- **Walkthrough de promessas:**
  - `aioson browser:run . --script=.aioson/briefings/diagnostico-maturidade/walkthrough.json --prototype` deu PASS em 70/70 passos;
  - relatório em `.aioson/briefings/diagnostico-maturidade/browser/prototype-diagnostico-maturidade.json`;
  - promessas provadas: PROM-001, 002, 003, 004, 005, 006, 007, 012, 013, 014, 016, 017, 018, 019, 020, 021, 022, 023 e 024;
  - PROM-008 (API HTTP) não se aplica ao protótipo, que não tem backend.
- **Defeito de produto achado pelo walkthrough e corrigido:**
  - a validação no blur do CNPJ inseria a mensagem de erro e deslocava o botão "Começar o diagnóstico" entre o mousedown e o mouseup, então o clique caía fora e o envio não acontecia;
  - correção 1: quando o foco vai direto para enviar ou avançar, a validação fica com o envio;
  - correção 2: a linha de erro tem espaço reservado e a mensagem do CNPJ cabe numa linha;
  - correção 3: corrigir um campo limpa o próprio erro.
- **Smoke Playwright (1280×860 e 390×844):** sem erros de console ou de página, e sem rolagem horizontal em início, resultado, configurações e questionário no celular. Ações exercitadas:
  - máscara de moeda e cálculo do custo por cliente;
  - alerta de respostas faltando;
  - portão em ouro para concluir, depois carregamento e resultado;
  - CNPJ inválido recusado e válido aceito, no modal e no assistente;
  - criar empresa, alternar o tema, recomeçar e o assistente de primeiro uso.
- **Tour de primeiro uso:**
  - 5 passos em linguagem leiga no modo empresa e 4 no modo consultoria, cada um ancorado em `data-aioson-tour`;
  - pode ser dispensado e é reaberto pelo botão "?" do topo.
- **`data-aioson-primary`:** a escada com trava na tela inicial, no resultado e na comparação. Começa na primeira dobra no desktop e no mobile, sem achado de dobra na medição em runtime.
- **Microinterações ligadas à assinatura:**
  - o traço batuta se desenha na legenda da prancha a cada troca de rota;
  - as barras de encaixes e frentes se preenchem quando entram na tela (IntersectionObserver, uma vez só);
  - a poeira atrás da escada respira em 8 s só no tema escuro;
  - tudo fica estático com `prefers-reduced-motion`.
- **Walkthrough de primeiro contato:** um subagente sem acesso a código nem a documentos, só ao snapshot da página.
  - Ele descreveu o produto como "um app que diagnostica em que degrau de crescimento uma pequena empresa está, mostra o que está travando e sugere 3 ações", para o dono ou o consultor, e apontou como mais importante "o degrau atual com o único motivo que impede subir e as 3 ações". Isso bate com as promessas do briefing, e não houve achado bloqueante.
  - Os 10 pontos de confusão que ele citou foram corrigidos no texto:
    - versão das regras e confiança explicadas;
    - o número que vale na comparação entre versões;
    - "Sustentaria o estágio" com a regra da dimensão mais fraca;
    - "4 encaixes e 4 frentes";
    - a nota do risco como probabilidade × impacto;
    - o trilho sempre numerado;
    - os jargões "ME", "Mais de um jeito", "margem", "Tinta" e "Porcelana";
    - a diferença entre "Descartar rascunho" e "Arquivar".

### Avisos restantes e justificativas

- **`input 20x20` no mobile da rota de erro:** são os botões de rádio dentro de rótulos `.choice`. O alvo de toque é o rótulo inteiro, com mais de 44px de altura e largura total, e o rádio é só o indicador visual.
- **Repetição de paleta com outro projeto do ecossistema (matiz ~124° sobre fundo escuro):**
  - é continuidade intencional: o app segue o design system do ecossistema que o dono mandou usar, com fundo tinta e o metal próprio do app (bronze antigo, só deste software);
  - a composição (escada com trava sobre a pauta), as três vozes tipográficas e o uso de ouro só no portão diferenciam a superfície;
  - o metal do app é proposta para o dono confirmar no design system de origem.
- **`craft_axes.evidence: false`:** a tela não usa imagens. O produto argumenta com dados do próprio diagnóstico (escada, números, barras) e não com fotografia.

### Limitações conhecidas

- Somente demonstração: atualizar a página volta ao estado inicial, não há backend nem banco, e as regras de cálculo são fictícias (o conteúdo metodológico v1 vem no PRD, decisão F5).
- PDF, exportação e importação de cópia são simulados.
- As máscaras de moeda e CNPJ aceitam só digitação no fim do campo (append-only): editar no meio do valor leva o cursor ao final. A implementação real precisa recalcular a posição do cursor.
- No modo "minha empresa", a base de demonstração ainda contém as empresas de exemplo da consultoria (acessíveis por URL e pela troca da empresa em foco).
