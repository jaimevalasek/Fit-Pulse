---
kind: identity
scope: briefing
slug: relatorios-e-acompanhamento
source: references
generated_by: reference-identity-extract
generated_at: 2026-10-24
confidence: high
theme: dark
register: quiet
base_unit: 4px
---

## Design pillars

1. **Tinta quente, porcelana como luz.** O tema escuro "tinta" é o padrão e o claro "porcelana" é a alternativa. Os cinzas são sempre quentes e nenhum azul é estrutural: nem fundo, nem borda, nem botão.
2. **Três vozes com papéis fixos.**
   - A estrutura fala em sans: títulos, navegação e corpo.
   - A intenção humana fala em serif itálico, sempre curto e no metal do contexto. É o momento em que a pessoa decide, como a trava e o próximo passo.
   - A máquina fala em mono: notas, valores, versão das regras, confiança e datas de evidência.
   - A máquina nunca fala em serif e a intenção nunca fala em mono.
3. **Um metal por software.** O FitPulse veste o **bronze antigo**. O ouro aparece só na marca e nos portões de decisão humana (concluir diagnóstico, confirmar ação definitiva); nenhum outro metal da família é usado como acento do app.

## Palette

Os dois temas são guardados em slots com o mesmo nome. Quem consome referencia sempre o slot, nunca o hex.

| Role | Slot | Tinta (escuro, padrão) | Porcelana (claro) |
|---|---|---|---|
| background / base | `--tinta` | `#0b0a08` | `#f1ede3` |
| background / alternate | `--tinta-2` | `#0f0d0a` | `#e9e4d6` |
| background / surface | `--superficie` | `#161310` | `#f9f6ee` |
| background / elevated | `--superficie-2` | `#1d1914` | `#fffdf7` |
| background / solid (menus, modais) | `--solido` | `#242019` | `#fffdf7` |
| foreground / primary | `--marfim` | `#f5f1e8` | `#1c1710` |
| foreground / secondary | `--marfim-2` | `#cdc5b4` | `#4c4436` |
| foreground / muted | `--fumaca` | `#8f8674` | `#7d7362` |
| border / default | `--linha` | `rgba(224,203,163,.14)` | `rgba(92,74,44,.14)` |
| border / strong | `--linha-2` | `rgba(233,214,177,.28)` | `rgba(92,74,44,.26)` |
| brand / app metal (FitPulse) | `--bronze` | `#a8c07a` | `#55692a` |
| brand / ink on app metal | `--bronze-tinta` | `#0b0a08` | `#fffdf7` |
| brand / platform (marca e portões) | `--ouro` | `#e8ba52` | `#8a6512` |
| semantic / success, vivo | `--patina` | `#6ec6a2` | `#177a58` |
| semantic / warning | `--cobre` | `#d8895b` | `#a55a30` |
| semantic / danger | `--perigo` | `#e25d5d` | `#bf3d47` |

Contraste medido para texto:
- `--bronze` sobre `--tinta`: 9,9:1. `#55692a` sobre `#f1ede3`: 5,2:1.
- `--ouro` sobre `--tinta`: 10,9:1. `#8a6512` sobre `#fffdf7`: 5,2:1.
- Botão bronze com texto `--bronze-tinta`: 9,9:1 no escuro e 6,0:1 no claro.

Regras de uso:
- Sucesso e "subiu" falam em pátina, aviso e "atenção" falam em cobre, erro e risco alto falam em perigo. Nunca só pela cor: sempre há ícone ou texto junto.
- Os metais são da família. O bronze antigo é o material novo, justificado por ser um software novo, e é usado só pelo FitPulse.

## Typography

- **Estrutura (sans):** `Inter, "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif`. Entregue por webfont (Inter 400/500/600/700), com fallback que preserva a hierarquia.
- **Intenção humana (serif itálico):** `Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif`, `font-style: italic`. É fonte do sistema e não precisa de webfont.
- **Máquina (mono):** `"JetBrains Mono", "Cascadia Code", ui-monospace, monospace`. Entregue por webfont (400/500), com números tabulares.

Escala (rem sobre 16px):
- display: 3.5rem, 700, letter-spacing -0.035em, line-height 1.02;
- page title: 2.25rem, 700, -0.03em, 1.1;
- section: 1.5rem, 600, -0.02em, 1.2;
- subsection: 1.125rem, 600;
- body: 1rem, 400, line-height 1.6;
- small: 0.875rem;
- meta mono: 0.75rem, 500, letter-spacing .14em, caixa alta (nunca abaixo de 12px).

A palavra decisiva de um título pode ir em serif itálico no metal, e só uma por título.

## Spacing & layout

- **Spacing scale (base 4px):** 4, 8, 12, 16, 24, 32, 48, 64, 96.
- **Breakpoints:** 640px (celular), 860px (tablet; colunas viram uma) e largura máxima de conteúdo de 1120px.
- **Gutter:** 24px no desktop e 16px no celular.
- **Grid:** duas colunas assimétricas (1.15fr/1fr) nas telas de decisão. Listas e tabelas em largura total, com linhas e fios finos em vez de cartões.
- **Ritmo:** 32 a 48px entre seções, sempre com a pauta (cinco fios) como divisor nas telas de decisão.
- **Controles:** 40px de altura no desktop e 44px no celular.

## Radius & depth

- **Radius ladder:** 6px (chips, controles pequenos), 10px (inputs, botões) e 16px (painéis, modais, prancha).
- **Depth strategy:** `borders-only`.
  - Painéis e modais se separam por fio fino (`--linha`, ou `--linha-2` quando ativos) e por troca tonal de slot (`--superficie` → `--solido`).
  - Não há sombra projetada. O modal se destaca pelo véu escuro do fundo, não por sombra.

## Motion

- **Duração e easing:** 160ms para feedback de controle e 220ms para troca de estado, com `cubic-bezier(.22,.61,.36,1)`. O movimento usa só `transform` e `opacity`.
- **Entrada:**
  - As seções do resultado sobem 8px e aparecem em sequência, com 60ms entre elas e no máximo 5 itens, uma única vez por tela.
  - O traço batuta se desenha da esquerda para a direita em 360ms quando a rota muda.
- **Ambiente:** a poeira (nebulosa no metal do app + fagulhas ouro e bronze de 1,5 a 2px) respira em 8s, só no tema tinta.
- **Movimento reduzido:** `prefers-reduced-motion: reduce` desliga entradas, traços e respiração; a tela já nasce no estado final. No tema porcelana a poeira é sempre estática.

## Signature moves

1. **Escada com trava sobre a pauta.**
   - Os quatro estágios são degraus que nascem dos cinco fios da pauta, com o compasso de 2px no bronze à esquerda.
   - O degrau atual fica preenchido em bronze e o anterior tracejado como rastro.
   - Um cadeado no próximo degrau nomeia o que impede a subida.
2. **A decisão fala em itálico, a evidência fala em mono.**
   - A trava e o próximo passo aparecem em serif itálico no bronze.
   - Notas, custo por cliente, versão das regras e confiança aparecem em mono com o traço batuta.
3. **Ouro só no portão.** Concluir um diagnóstico e confirmar uma ação definitiva são os únicos botões em ouro; todo o resto da ação primária veste bronze.

## Anti-goals

- **Fundo azulado ou acentos frios estruturais:** nada de ciano, violeta neon, menta ou coral da identidade antiga.
- **Painel de agência:** gráficos neon, glow, KPIs inflados e paredes de cartões iguais.
- **Quiz de captação de lead:** "fale com um especialista", contagem regressiva ou gamificação.
- **Vozes trocadas e ouro mal usado:** serif na máquina, mono na intenção, ou ouro como cor de produto.

## Component structure notes

Notas tiradas das telas já implementadas do FitPulse (`src/components/`, `src/features/`), que as telas novas devem repetir:

- **Topo:** barra única arredondada (16px) com a marca à esquerda, a navegação ao centro (Início, Minha empresa ou Empresas, Configurações; o ativo é sublinhado em bronze), o modo de uso em mono, o tema e o "?" à direita.
- **Cabeçalho de página:** migalha em bronze, título de página e uma linha de meta. A ação primária (bronze) fica à direita.
- **Listas:** linhas separadas por fio fino `--linha`, com data em mono à esquerda e ações de texto à direita. Não há cartão por item.
- **Botões:** primário em bronze; secundário com contorno `--linha-2`; terciário só texto; ouro apenas no portão de decisão.
- **Chips:** contorno fino, mono em caixa alta, 6px de raio. A cor semântica vem sempre acompanhada de texto.
- **Diálogos:** superfície `--solido`, fio `--linha-2` e véu `--scrim`. O título nomeia ação e objeto, a linha de consequência diz se dá para desfazer, o botão de confirmar leva o verbo e Esc cancela.
- **Campos:** 40px (44px no celular), rótulo acima, ajuda abaixo e erro inline com `aria-invalid`. Moeda com máscara `R$` e CNPJ com dígito verificador.

## Provenance

- **Fontes:** 1 documento de design system do ecossistema da plataforma, 2 arquivos de tokens (CSS e JSON) e 1 captura renderizada da demonstração do tema escuro.
- **Origem:** fornecidas pelo dono em 2026-10-22 e copiadas para `references/identity/` com fingerprint SHA-256.
- **Descartadas:** capturas antigas do mesmo acervo na identidade azul, desconsideradas por instrução do próprio documento.
- **Reuso (2026-10-24):** este registro é a cópia da identidade aprovada de `diagnostico-maturidade`, feita pela decisão F14 do refinamento de `relatorios-e-acompanhamento` (opção `identity-references`). As referências foram copiadas para `references/identity/` deste briefing com os mesmos SHA-256. Os valores conferem com `src/styles/tokens.css`, já implementado. A única diferença do código é `--fumaca`/`--text-muted`: `#958c7a` no escuro e `#6b6252` no claro, ajustados na implementação para contraste.
- **Proposta deste registro:** o bronze antigo como metal do app, proposto para este software. O documento de origem permite material novo para software novo.
