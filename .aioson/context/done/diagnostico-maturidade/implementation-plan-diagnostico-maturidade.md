---
feature: diagnostico-maturidade
status: approved
plan_contract: 2
source_briefing: .aioson/briefings/diagnostico-maturidade/briefings.md
sheldon_review: required
prototype: .aioson/briefings/diagnostico-maturidade/prototype.html
prototype_status: current
prototype_feature: diagnostico-maturidade
runtime_contract: required
source_prd: .aioson/context/prd-diagnostico-maturidade.md
source_prd_sha256: d9946f2e69c56c04edc3b74ccbda5ccc9dbe7a2032346646086e80015a446b8e
---

# Implementation Plan — diagnostico-maturidade

## Objective

O dono de uma pequena empresa instala o FitPulse pelo AIOSON Play e, sem login nem configuração técnica, responde o diagnóstico e vê estágio, trava, números e 3 ações. Depois ele volta e compara a evolução, e tudo continua no próprio computador através de atualizações.

## Repository evidence

- Production entry point: o AIOSON Play roda `pnpm run dev` (dev-link) ou `pnpm start` (loja) na raiz do app.
  - `concurrently` sobe `tsx server/main.ts` (Express em `127.0.0.1:BACKEND_PORT`) e `vite`/`vite preview` (`127.0.0.1:PORT`, proxy `/api` → backend).
  - O webview do Play carrega `http://127.0.0.1:<PORT>` (`.aioson/docs/integrations/port-management.md` §8; `C:/dev/aioson-play/src-tauri/src/draft_window.rs` `embed_app_webview`).
  - Na instalação e no update, o Play roda `pnpm install`, que dispara o `postinstall` (`.aioson/docs/integrations/software-update-compatibility.md` §10.1).
- Existing patterns to reuse: o repositório não tem código (só o stub `manifest.json`, inspecionado em 2026-10-22).
  - Pacote único com `server/` + `src/` e `concurrently` com `tsx` e `vite`/`vite preview`, como o app irmão `C:/dev/playapps/flow-deck/package.json`.
  - Contrato split-stack: `.aioson/docs/play/manifest-and-runtime.md`.
  - Tokens: `.aioson/briefings/diagnostico-maturidade/references/identity/tokens.css` e `identity.md`.
  - Composição, textos e as 22 interações: `prototype.html` e `prototype-manifest.md` aprovados.
  - Formulários: `.aioson/learnings/gotchas/blur-validation-swallows-submit-click.md`.
- Test runner: `aioson detect:test-runner` não encontrou nenhum. Este plano fixa Vitest (`pnpm test`, unidade e API) e Playwright (`pnpm test:e2e`); o QA reutiliza os dois.

## Technical decisions

Respostas às perguntas que o PRD deixou para o @planner e escolhas de stack tiradas de evidência:

| Questão | Evidência | Decisão |
|---|---|---|
| OQ-2 — binário do SQLite | A dependência é `better-sqlite3 ^12.6.0` (via `@prisma/adapter-better-sqlite3` 7.10.1). A versão 12.11.1 publica binários prontos para Node 22, 24, 25 e 26 em win32 x64/arm64 e darwin x64/arm64, e não para Node 20 (assets da release no GitHub, conferidos em 2026-10-22). O Play só considera seguro o Node LTS por causa desse binário (`dependencies.rs`, `node_is_lts_line`). A CLI aioson 1.75.0 já carrega `better-sqlite3 ^12.11.1` nesta máquina (Node 24.19) | Manter Prisma 7.10.1 com o adapter better-sqlite3; `engines.node` fica `^22.12.0 \|\| >=24.0.0` |
| OQ-3 — desinstalar | A desinstalação da loja roda `remove_dir_all` na pasta do app (`systems.rs`, `uninstall_app_unchecked`) | Os dados em `data/` são apagados. Pelo próprio ramo da OQ-3, a seção de cópia de segurança avisa para exportar antes |
| OQ-4 — salvar e abrir arquivo | O app roda num webview filho criado com `WebviewBuilder::new`, sem tratador de download (`draft_window.rs`). O WKWebView não tem `showSaveFilePicker` | O backend grava o PDF e a cópia na pasta Downloads do usuário com o nome sugerido, e a tela informa onde salvou. A importação usa `<input type="file">` e envia JSON. O ramo "cancelar" da AC-dm-36 não tem gatilho (não há janela de salvar); o ramo de falha continua |
| OQ-5 — slug técnico | O slug é reutilizado por registro, binding e update (`manifest-and-runtime.md`); nada foi publicado ainda | Slug `fitpulse` no `manifest.json` e no `system.json`, decidido pelo dono nesta sessão |
| OQ-6 — login do Play | O Play exige login do dono para abrir (`.aioson/docs/integrations/platform-architecture.md` §3.2) | A nota de segurança das Configurações diz que o acesso é protegido pelo login do Play e que o app não tem login próprio |
| Gestor de pacotes na loja | O Play escolhe o gestor pelo campo `packageManager` e depois pelo lockfile (`draft_runtime.rs`, `detect_package_manager`). O pacote da loja descarta todos os lockfiles (`C:/dev/aioson/src/commands/store-system.js`, `SKIP_FILES`). O pnpm 11.21.0 desta máquina falha a instalação quando uma dependência com script de build não está em `allowBuilds` | `packageManager: pnpm@11.21.0`, versões exatas nas dependências de execução e `pnpm-workspace.yaml` com `allowBuilds` |
| Modo de publicação | No modo `--build`, `store-system.js` só leva TypeScript que está em `server/` e deixa de fora `shared/`, `prisma.config.ts` e arquivos de fonte (`SYSTEM_BUILD_ALLOWED_EXTS`). No modo fonte, ele descarta `dist/` e mantém o resto | Publicar em modo fonte, sem `--build`. O `postinstall` gera o cliente Prisma, migra e roda `vite build` na máquina do usuário. As fontes vêm de `@fontsource` pelo npm |
| Layout | O `project.context.md` previa `frontend/` + `backend/` em pacotes separados. O empacotador trata `server/` como código de execução, e o app irmão flow-deck usa um pacote único | Pacote único: `server/` (Express + Prisma), `src/` (React), `shared/` (regras, conteúdo e formatação puros, usados pelos dois lados). Assim há uma instalação e um `postinstall` |
| Linguagem | O `project.context.md` deixou TypeScript para o @planner confirmar | TypeScript em tudo; o backend roda com `tsx` |

## Engineering Controls

| Concern | Evidence / trigger | Planned control | Verification | Recovery |
|---|---|---|---|---|
| dependency risk | O pacote da loja não leva lockfile, então a instalação resolve as faixas de versão na hora. O pnpm 11 trata scripts de build não aprovados como erro. O better-sqlite3 não tem binário pronto para Node 20 | `packageManager: pnpm@11.21.0`, `engines.node`, versões exatas das dependências de execução. `allowBuilds` explícito, com `strictDepBuilds: false` para que um script novo de dependência transitiva seja pulado em vez de derrubar a instalação (Fase 1) | `node scripts/smoke-store-package.mjs` (instalação limpa a partir do pacote real, sem lockfile) | Nenhum estado gravado; corrigir `package.json`/`pnpm-workspace.yaml` e publicar de novo |
| compatibility | `store-system.js`: o modo `--build` descarta `shared/`, `prisma.config.ts` e as fontes. O update do Play sobrepõe sem apagar, então um `dist/` antigo continuaria lá | Publicar em modo fonte. `scripts/prepare-app.mjs` refaz `dist/` em todo `postinstall` quando `src/` existe (Fase 1) | `node scripts/smoke-store-package.mjs` confere o conteúdo do pacote e o `dist/` com fontes depois da instalação | Publicar de novo; nenhum dado é afetado |
| data/schema and recovery | O SQLite fica em `data/fitpulse.db` dentro da pasta do app. O update roda `pnpm install` → `postinstall`. O Play guarda um backup do app antes do update (§10.1). A desinstalação apaga a pasta | `data/` no `.gitignore` (o empacotador respeita). Só `prisma migrate deploy` com SQL versionado, nunca `db push`. `compatibility.schema_version: 1`. `dev` e `start` migram antes de subir, então uma migração com falha impede o app de abrir pela metade. Aviso de desinstalação na cópia de segurança (Fases 1 e 4) | `node scripts/smoke-migrate.mjs` + simulação de update no `smoke-store-package.mjs` | O backup do Play feito antes do update; nunca editar uma migration publicada; a próxima mudança de esquema sobe `schema_version` |
| authorization | Não há login (RULE-dm-16) e existem rotas destrutivas (excluir empresa, importar). Uma página aberta no navegador da mesma máquina consegue mandar um POST simples para `127.0.0.1` e ler a resposta via DNS rebinding | Express, Vite e `vite preview` escutam só em `127.0.0.1`. `server/http/requestGuards.ts`: Host permitido só `127.0.0.1`/`localhost` nas portas do app; POST/PUT/PATCH exigem `application/json`; nenhum cabeçalho CORS (Fase 1) | `pnpm test -- tests/api/playRoutes.test.ts` (Host estranho → 403; `text/plain` → 415) + sondagem de rede local no `smoke-boot.mjs` | Sem estado |
| validation | Formulário de empresa, respostas, calculadora, preferências e importação recebem dados do usuário (SEC-SBD-01) | Schemas zod no servidor com limites de tamanho, faixa e catálogo, e o mesmo schema para criar e editar. `express.json` de 1 MB (10 MB só na importação) (Fases 1, 3 e 4) | Casos negativos em `tests/api/companyRoutes.test.ts`, `diagnosisRoutes.test.ts`, `preferenceRoutes.test.ts` e `backupRoutes.test.ts` | Sem estado: a requisição é recusada antes de gravar |
| upload | A importação da cópia recebe um arquivo do usuário (SEC-SBD-02) | Só JSON com a marca `fitpulse-backup`, schema completo e limite de tamanho. Versão mais nova recusada. Tudo numa transação, pulando ids existentes (Fase 4) | `pnpm test -- tests/api/backupRoutes.test.ts` | A transação desfaz tudo; nada muda |
| concurrency/idempotency | Um rascunho por empresa (RULE-dm-13) e cliques duplos em "Novo diagnóstico" e "Concluir" | O início do rascunho roda numa transação que devolve o rascunho existente. A conclusão é uma atualização condicional (`status = draft`) e devolve o resultado já gravado. Os botões ficam desabilitados enquanto a ação está pendente (Fase 1) | `tests/api/diagnosisRoutes.test.ts` com dois inícios e duas conclusões em paralelo | Sem estado parcial: a transação desfaz |
| file writes | O PDF e a cópia são gravados pelo backend (decisão da OQ-4), com nome derivado do nome da empresa | `server/files/downloadsFolder.ts`: pasta fixa, nome saneado, sufixo único, gravação em temporário + renomeação; o cliente nunca manda caminho (Fases 2 e 4) | `pnpm test -- tests/api/reportRoutes.test.ts` com nomes hostis e falha de gravação | Falha não deixa arquivo pela metade |
| accessibility/localization | AC-dm-46, AC-dm-47 e AC-dm-48; interface pt-BR com R$ e datas brasileiras | AlertDialog do shadcn (foco preso, Esc). Linha de erro reservada. `Intl` pt-BR para dinheiro e datas. Animações sob `prefers-reduced-motion`. Verificações em 390 px com axe nos dois temas (Fases 1 a 4) | `pnpm test:e2e -- tests/e2e/accessibility.spec.ts` + 390 px e axe nas specs de cada fase | Sem estado |
| external requests | RULE-dm-19: nenhuma requisição externa em execução | Fontes de `@fontsource` empacotadas pelo Vite e embutidas no PDF; nenhuma chamada de rede no app; `CHECKPOINT_DISABLE=1` no Prisma durante a instalação (Fase 1) | Fixture automática `tests/e2e/support/fixtures.ts`: qualquer requisição fora de `127.0.0.1`/`localhost` reprova qualquer e2e | Sem estado |

Sem gatilho, sem controle: observabilidade (app local, sem telemetria pelo PRD; erros inesperados vão para o stderr que o Play captura) e desempenho (motor puro sobre 24 itens; AC-dm-27 medida no smoke).

## Implementation Delta

| CAP | Action | Existing evidence | Exact paths | Required change |
|---|---|---|---|---|
| CAP-dm-play-runtime | modify | Stub `{slug: v-stage, name: V-Stage}` sem `runtime`, `processes`, `has_api` ou `compatibility` | manifest.json | Nome FitPulse e slug aprovado; `runtime: node`, `has_api: true`, `stack: split`, `processes` frontend `PORT` / backend `BACKEND_PORT`, `webview_target: frontend`, `compatibility` com `schema_version: 1`, `requires_migration: false` e `min_play_version: 0.1.92`; sem `requires_services` e sem `auth` |
| CAP-dm-play-runtime | create | `store-system.js` (`readSystemJson`) exige `system.json` para publicar; não existe | system.json | Manifesto da loja espelhando slug, nome, versão e descrição; sem `build_command` (publicação em modo fonte) |
| CAP-dm-play-runtime | create | Raiz inspecionada em 2026-10-22: só `manifest.json` (stub), `.gitignore` e pastas AIOSON; sem `package.json` | package.json | ESM; `packageManager: pnpm@11.21.0`; `engines.node: ^22.12.0 \|\| >=24.0.0`; scripts `dev`, `start`, `postinstall`, `build`, `typecheck`, `test`, `test:e2e`, `smoke:*`; todas as dependências do plano declaradas aqui (inclusive pdfkit, react-router, @fontsource, pacotes Radix do shadcn, unpdf, vitest, @playwright/test e @axe-core/playwright), com versões exatas nas de execução (prisma, @prisma/client e @prisma/adapter-better-sqlite3 em 7.10.1) |
| CAP-dm-play-runtime | create | pnpm 11.21.0 tem `strictDepBuilds: true` por padrão e trocou `onlyBuiltDependencies` por `allowBuilds` (CHANGELOG do pnpm) | pnpm-workspace.yaml | `allowBuilds` com `true` para better-sqlite3, prisma, @prisma/engines e esbuild e decisão explícita para todo pacote que `pnpm install` listar; `strictDepBuilds: false`; sem campo `packages` |
| CAP-dm-play-runtime | create | Raiz inspecionada em 2026-10-22: só `manifest.json` (stub), `.gitignore` e pastas AIOSON; sem `package.json` | pnpm-lock.yaml | Gerado pelo `pnpm install`; versionado para o desenvolvimento (o pacote da loja não o leva) |
| CAP-dm-play-runtime | modify | Só entradas AIOSON; não ignora `node_modules/`, `data/`, `dist/` | .gitignore | Adicionar `node_modules/`, `data/`, `dist/`, `server/generated/`, `test-results/`, `playwright-report/`, `.env`; o empacotador respeita o `.gitignore`, então o banco nunca viaja |
| CAP-dm-play-runtime | create | Raiz inspecionada em 2026-10-22: só `manifest.json` (stub), `.gitignore` e pastas AIOSON; sem `package.json` | tsconfig.json | TypeScript estrito para `src/`, `server/`, `shared/` e `tests/`; alias `@/*` → `src/*`; `noEmit` |
| CAP-dm-play-runtime | create | Contrato de portas em `.aioson/docs/integrations/port-management.md` §8 | vite.config.ts | Plugins React e Tailwind; `server` e `preview` com host `127.0.0.1`, `port: Number(process.env.PORT) \|\| 5173`, `strictPort` e proxy `/api` → `http://127.0.0.1:${Number(process.env.BACKEND_PORT) \|\| 3301}` |
| CAP-dm-play-runtime | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | index.html | `lang="pt-BR"`, título FitPulse, nenhum link externo |
| CAP-dm-play-runtime | create | Prisma 7 exige o arquivo de configuração com a URL (`project.context.md` Notes) | prisma.config.ts | Caminhos do schema e das migrations; URL de `resolveDatabaseUrl()` |
| CAP-dm-play-runtime | create | Raiz inspecionada em 2026-10-22: só `manifest.json` (stub), `.gitignore` e pastas AIOSON; sem `package.json` | prisma/schema.prisma | Gerador `prisma-client` com saída em `../server/generated/prisma`; modelos `Company` (`companies`), `Diagnosis` (`diagnoses`) e `Preference` (`preferences`) com nomes de coluna snake_case e ids UUID em texto |
| CAP-dm-play-runtime | create | Raiz inspecionada em 2026-10-22: só `manifest.json` (stub), `.gitignore` e pastas AIOSON; sem `package.json` | prisma/migrations/migration_lock.toml | `provider = "sqlite"` |
| CAP-dm-play-runtime | create | Raiz inspecionada em 2026-10-22: só `manifest.json` (stub), `.gitignore` e pastas AIOSON; sem `package.json` | prisma/migrations/20261023000000_init/migration.sql | Gerada com `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`; nunca editada depois de publicada |
| CAP-dm-play-runtime | create | O update do Play roda `pnpm install`, que dispara o `postinstall` (`software-update-compatibility.md` §10.1) | scripts/prepare-app.mjs | Flags `--generate`, `--migrate`, `--build`; cria `data/`; roda `prisma generate` e `prisma migrate deploy` com `CHECKPOINT_DISABLE=1`; roda `vite build` sempre que `src/` existe; sai com código diferente de 0 em falha |
| CAP-dm-play-runtime | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | scripts/smoke-migrate.mjs | Banco temporário: deploy, grava dados, aplica uma migration sintética a partir de uma cópia de `prisma/migrations`, confere os dados e repete o deploy sem efeito |
| CAP-dm-play-runtime | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | scripts/smoke-boot.mjs | Sobe `pnpm start` com portas livres e banco temporário; testa `/api/health` no backend, `/` e `/api/health` pelo proxy; tenta cada IPv4 externo de `os.networkInterfaces()` nas duas portas e espera conexão recusada |
| CAP-dm-play-runtime | create | `store-system.js` descarta lockfiles e `dist/` e respeita o `.gitignore`; o Play escolhe o gestor pelo `packageManager` (`draft_runtime.rs`) | scripts/smoke-store-package.mjs | Roda `aioson system:package .`, materializa o pacote gerado num diretório temporário, confere a ausência de `data/`, `*.db`, lockfile, testes e `aioson-models.json`, instala com `pnpm install` sem lockfile, confere o binário do better-sqlite3, o banco e o `dist/` com fontes, sobe o app, grava dados, simula o update (sobrepõe o pacote com uma migration sintética e roda `pnpm install`) e confere os dados |
| CAP-dm-play-runtime | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/main.ts | Lê `BACKEND_PORT` (fallback 3301), escuta em `127.0.0.1`, monta o app com Prisma real e a pasta Downloads; fecha e desconecta em SIGTERM/SIGINT |
| CAP-dm-play-runtime | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/app.ts | `createApp(deps)` com `express.json` (1 MB), guardas de requisição, rotas (play, empresas, diagnósticos) e tratador de erro; `prisma`, `now()` e `downloadsDir` injetados |
| CAP-dm-play-runtime | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/db/databaseUrl.ts | `DATABASE_URL` quando definida; senão `file:` com caminho absoluto para `<raiz do app>/data/fitpulse.db`; garante a pasta `data/` |
| CAP-dm-play-runtime | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/db/prismaClient.ts | PrismaClient com `PrismaBetterSqlite3`; aplica `journal_mode=WAL`, `busy_timeout=5000` e `foreign_keys=ON` ao iniciar |
| CAP-dm-play-runtime | create | API local sem login (RULE-dm-16) com rotas destrutivas | server/http/requestGuards.ts | Host fora de `127.0.0.1`/`localhost` nas portas do app → 403; POST/PUT/PATCH sem `application/json` → 415; nenhum cabeçalho CORS |
| CAP-dm-play-runtime | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/http/errorHandler.ts | Formato `{ error: { code, message } }`; ZodError → 400 com campos; DomainError → status próprio; erro inesperado → 500 e log no stderr |
| CAP-dm-play-runtime | create | Regra 7 do contrato Play em `CLAUDE.md` | server/routes/playRoutes.ts | `GET /api/health`, `GET /api/aioson-play` (nome, slug e versão do `manifest.json`, `api_base_url` de `BACKEND_PORT`, só as rotas de saúde e de resumo, `events: []`) e `GET /api/assistant/summary` |
| CAP-dm-play-runtime | create | RULE-dm-17 | server/services/assistantSummaryService.ts | Por empresa ativa: nome, estágio, dimensão que mais trava e data do último concluído não arquivado; nenhum valor em reais e nenhuma resposta |
| CAP-dm-play-runtime | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/main.tsx | Monta o app; importa os pesos de `@fontsource/inter` e `@fontsource/jetbrains-mono` e `global.css` |
| CAP-dm-play-runtime | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/App.tsx | Roteador por hash com as rotas do protótipo (`#/empresas`, `#/empresa/:id`, `#/diagnostico/:id`, `#/resultado/:id`); `/` vai para `#/empresas` até a Fase 3; tela de rota inexistente |
| CAP-dm-play-runtime | create | `references/identity/tokens.css` e `identity.md` | src/styles/tokens.css | Slots dos temas tinta (padrão) e porcelana, bronze antigo `#a8c07a`/`#55692a`, ouro só na marca e nos portões; troca por `data-theme`; nenhum azul estrutural |
| CAP-dm-play-runtime | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/styles/global.css | `@import "tailwindcss"`, `@theme` ligado aos tokens, as três vozes tipográficas, anel de foco, profundidade só por bordas e animações desligadas sob `prefers-reduced-motion` |
| CAP-dm-play-runtime | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/components/layout/AppShell.tsx | Topo com a marca "FitPulse", navegação (Empresas), região principal e link "pular para o conteúdo" |
| CAP-dm-play-runtime | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | vitest.config.ts | Ambiente node para `tests/unit` e `tests/api` |
| CAP-dm-play-runtime | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | playwright.config.ts | `webServer` com `pnpm dev`, PORT/BACKEND_PORT fixas de teste, `DATABASE_URL` de um banco e2e temporário e `HOME`/`USERPROFILE` apontando para uma pasta temporária; projeto `fresh-db` (estados vazios) antes do projeto `main` |
| CAP-dm-play-runtime | create | Regra `crud-surface-integrity`: testes partem de banco limpo | tests/helpers/testDatabase.ts | Cria um SQLite migrado novo por arquivo de teste (cópia de um modelo migrado uma vez) e devolve as dependências de `createApp` |
| CAP-dm-play-runtime | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/api/playRoutes.test.ts | Esquema com exatamente as 2 rotas reais; resumo sem chaves de dinheiro ou respostas depois de uma conclusão real pela API; Host estranho → 403; POST `text/plain` → 415 |
| CAP-dm-play-runtime | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/e2e/global-setup.ts | Apaga e migra o banco e2e antes da execução |
| CAP-dm-play-runtime | create | RULE-dm-19 (nenhuma requisição externa) | tests/e2e/support/fixtures.ts | Fixture automática que bloqueia e registra qualquer requisição fora de `127.0.0.1`/`localhost` e reprova o teste; ajudantes de 390 px, movimento reduzido e axe |
| CAP-dm-play-runtime | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/e2e/shell.spec.ts | Mostra "FitPulse" e nunca "V-Stage", nenhum campo de senha, Inter e JetBrains Mono carregadas (`document.fonts.check`) |
| CAP-dm-play-runtime | create | Feature de runtime: `has_api`, migrations Prisma e protótipo próprio | .aioson/plans/diagnostico-maturidade/harness-contract.json | Critérios com comandos distintos: RG-build `pnpm build`, RG-migrate `node scripts/smoke-migrate.mjs`, RG-boot `node scripts/smoke-boot.mjs`, RG-smoke `pnpm test:e2e`, C-unit `pnpm test`, C-package `node scripts/smoke-store-package.mjs` |
| CAP-dm-company | create | project.context: Tailwind + shadcn/ui; sem configuração | components.json | Configuração do shadcn para Tailwind v4 com aliases `@/components` e `@/lib/utils` |
| CAP-dm-company | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/lib/utils.ts | Ajudante `cn` do shadcn |
| CAP-dm-company | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/components/ui/button.tsx | Botão do shadcn com variantes nos tokens (padrão, metal, ouro de portão, destrutivo) |
| CAP-dm-company | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/components/ui/alert-dialog.tsx | AlertDialog do shadcn (Radix: foco preso, Esc cancela) |
| CAP-dm-company | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/components/ui/input.tsx | Campo do shadcn nos tokens |
| CAP-dm-company | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/components/ui/label.tsx | Rótulo do shadcn |
| CAP-dm-company | create | Regra `status-change-confirmation`; AC-dm-48 | src/components/feedback/ConfirmDialog.tsx | Título, consequência, botão com o verbo (variantes destrutiva e ouro) e "Cancelar"; o confirmar não fica sob o clique que abriu; estado pendente impede confirmar duas vezes |
| CAP-dm-company | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/components/feedback/StatusView.tsx | Estados carregando, vazio e erro com `data-state` e ação de tentar de novo |
| CAP-dm-company | create | `.aioson/learnings/gotchas/blur-validation-swallows-submit-click.md` | src/components/form/TextField.tsx | Rótulo, erro na linha reservada, `aria-invalid`/`aria-describedby`; não renderiza o erro do blur quando o foco vai para o enviar; corrigir limpa o erro do campo |
| CAP-dm-company | create | Regra `form-fields-masks-and-validation`; AC-dm-08 | src/components/form/CnpjField.tsx | Máscara 00.000.000/0000-00 preservando o cursor, `inputmode="numeric"`, até 18 caracteres, dígito verificador no blur |
| CAP-dm-company | create | Sem código de domínio; regras e conteúdo v1 só no PRD (`## Conteúdo metodológico v1`) | shared/format/cnpj.ts | Mascarar, extrair dígitos e validar os dígitos verificadores |
| CAP-dm-company | create | Modais `company-create-modal`/`company-edit-modal` do protótipo | shared/content/companyOptions.ts | Opções de segmento, de como vende e de faturamento por ano (chaves em inglês, rótulos pt-BR) |
| CAP-dm-company | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/api/httpClient.ts | `fetch` para `/api` na mesma origem, só JSON, converte `{ error }` em erro tipado |
| CAP-dm-company | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/api/companiesApi.ts | Chamadas das rotas de empresa |
| CAP-dm-company | create | AC-dm-09 | src/features/companies/CompaniesPage.tsx | Busca, filtro por estágio (Todos, 1 a 4) sincronizado com `?estagio=`, alternância ativas/arquivadas, linhas com chave pelo id, estado vazio e "Nenhuma empresa encontrada" com "Limpar filtros" |
| CAP-dm-company | create | AC-dm-04, AC-dm-05 | src/features/companies/CompanyFormDialog.tsx | Criar e editar com os mesmos campos (paridade); nome 2 a 80, segmento e como vende obrigatórios, faturamento e CNPJ opcionais |
| CAP-dm-company | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/companies/CompanyPage.tsx | Cabeçalho, editar, arquivar/restaurar/excluir com ConfirmDialog (excluir mostra a quantidade de diagnósticos), "Começar o primeiro diagnóstico" / "Novo diagnóstico" / "Continuar diagnóstico" e link para o último resultado |
| CAP-dm-company | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/routes/companyRoutes.ts | `GET /api/companies` (q, stage, archived), `POST`, `GET/PATCH /api/companies/:id`, `POST :id/archive`, `POST :id/restore`, `DELETE :id` (409 se não arquivada) |
| CAP-dm-company | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/services/companyService.ts | Casos de uso de empresa; arquivar e restaurar nunca apagam dados (RULE-dm-15) |
| CAP-dm-company | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/services/domainError.ts | Erro de domínio com `code` e status HTTP |
| CAP-dm-company | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/repositories/companyRepository.ts | Consultas parametrizadas; estágio pelo último concluído não arquivado; exclusão da empresa e dos diagnósticos numa transação |
| CAP-dm-company | create | SEC-SBD-01 (`security-baseline.md`) | server/validation/companySchemas.ts | Mesmo conjunto de campos para criar e editar; limites de tamanho; opções só do catálogo; texto vazio vira ausente de forma explícita; CNPJ validado |
| CAP-dm-company | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/unit/cnpj.test.ts | Máscara e dígitos verificadores válidos e inválidos |
| CAP-dm-company | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/api/companyRoutes.test.ts | CRUD, filtros, excluir só arquivada, exclusão em cascata persistida, limites e campos inválidos |
| CAP-dm-company | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/e2e/companies.spec.ts | Preenche o cadastro, edita uma linha específica e confere o registro certo; arquivar/restaurar/excluir confirmando e cancelando; CNPJ inválido, corrigir e clicar em salvar na sequência (AC-dm-17); busca, filtro e estados vazios; 390 px e axe |
| CAP-dm-questionnaire | create | Sem código de domínio; regras e conteúdo v1 só no PRD (`## Conteúdo metodológico v1`) | shared/content/questionBank.ts | 8 blocos e as 24 perguntas com âncoras 0–3; "não sei" só em mp1, mp3, cm1, mm1 e co1; texto de ajuda por pergunta no padrão do protótipo |
| CAP-dm-questionnaire | create | Sem código de domínio; regras e conteúdo v1 só no PRD (`## Conteúdo metodológico v1`) | shared/domain/completeness.ts | Blocos pendentes a partir das respostas e da calculadora (AC-dm-14), usado pela tela e pelo servidor |
| CAP-dm-questionnaire | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/api/diagnosesApi.ts | Chamadas das rotas de diagnóstico |
| CAP-dm-questionnaire | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/diagnosis/QuestionnairePage.tsx | Questionário `#/diagnostico/:id` com trilho, bloco atual, navegação e descarte do rascunho |
| CAP-dm-questionnaire | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/diagnosis/BlockRail.tsx | Número de cada bloco, marca de respondido e links |
| CAP-dm-questionnaire | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/diagnosis/AnchoredQuestion.tsx | Grupo de opções âncora, botão "?" com `aria-expanded`, "não sei" só quando o catálogo permite |
| CAP-dm-questionnaire | create | AC-dm-12 | src/features/diagnosis/useDraftAutosave.ts | PATCH a cada escolha (com espera curta nos campos digitados), "Salvo automaticamente às HH:MM", estado de erro com nova tentativa |
| CAP-dm-questionnaire | create | AC-dm-14, AC-dm-27 | src/features/diagnosis/CompletionGate.tsx | Alerta `role="alert"` com os blocos pendentes e links; confirmação em ouro "Concluir o diagnóstico?"; estado "Calculando o seu diagnóstico"; abre o resultado |
| CAP-dm-questionnaire | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/routes/diagnosisRoutes.ts | `POST /api/companies/:id/diagnoses` (devolve o rascunho existente ou cria um preenchido com respostas e calculadora do último concluído), `GET/PATCH/DELETE /api/diagnoses/:id` (PATCH e DELETE só em rascunho), `POST /api/diagnoses/:id/complete` |
| CAP-dm-questionnaire | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/services/diagnosisService.ts | Conclusão: completude → 422 com os blocos pendentes; `evaluateDiagnosis` com as regras atuais; atualização condicional rascunho → concluído gravando `rules_version`, resultado, estágio e data numa transação; uma segunda chamada devolve o resultado gravado |
| CAP-dm-questionnaire | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/repositories/diagnosisRepository.ts | Consultas e escritas de diagnóstico; início de rascunho dentro de transação |
| CAP-dm-questionnaire | create | SEC-SBD-01 | server/validation/diagnosisSchemas.ts | Chaves de resposta só do banco de perguntas; valores 0–3 ou nulo só onde há "não sei"; calculadora em centavos inteiros ≥ 0 e com teto, clientes novos 0 a 1.000.000, margem 0 a 100, bloco 1 a 8 |
| CAP-dm-questionnaire | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/unit/questionBank.test.ts | 8 blocos, 24 perguntas, ajuda em todas, "não sei" só nas 5 de fato (AC-dm-10, AC-dm-11) |
| CAP-dm-questionnaire | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/api/diagnosisRoutes.test.ts | Um rascunho por empresa (inclusive com dois inícios simultâneos), pré-preenchimento, gravação e retomada, descarte que mantém concluídos, 422 com pendências, resultado congelado depois de trocar para `tests/fixtures/rulesV2.ts` (AC-dm-22), conclusão dupla sem recálculo, limites |
| CAP-dm-questionnaire | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/e2e/questionnaire.spec.ts | Responde os 8 blocos, recarrega e retoma, ajuda e "não sei", pendências, portão em ouro (confirmar e cancelar), descarte (confirmar e cancelar), novo a partir do anterior, 390 px |
| CAP-dm-unit-economics | create | Sem código de domínio; regras e conteúdo v1 só no PRD (`## Conteúdo metodológico v1`) | shared/content/calculatorOptions.ts | Rótulos das faixas de gasto e de clientes novos, frequência e tempo de relacionamento |
| CAP-dm-unit-economics | create | RULE-dm-03, RULE-dm-12 | shared/domain/unitEconomics.ts | CAC, LTV, margem mensal, relação e payback em centavos inteiros com arredondamento meio para cima; origem medida/estimada/desconhecida; BR-dm-14 e BR-dm-15 sem NaN nem Infinity |
| CAP-dm-unit-economics | create | Regra `example-monetary-values` | shared/format/money.ts | Formatar e ler R$ em centavos; máscara que preserva o cursor no meio do valor (desvio aprovado 5) |
| CAP-dm-unit-economics | create | RULE-dm-03 (exibição) | shared/format/displayNumbers.ts | Relação com uma casa ("4,6×"), payback em meses inteiros para cima, "não calculado", "não se paga" e rótulos das faixas da relação |
| CAP-dm-unit-economics | create | Regra `form-fields-masks-and-validation` | src/components/form/MoneyField.tsx | Máscara R$ 1.234,56, `inputmode="decimal"`, valor em centavos |
| CAP-dm-unit-economics | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/diagnosis/CalculatorBlock.tsx | Bloco "Seus números": gasto (seis valores, faixas ou "não sei"), clientes novos (número, faixas ou "não sei"), compra média, frequência, tempo e margem |
| CAP-dm-unit-economics | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/diagnosis/UnitEconomicsPanel.tsx | Painel ao lado que recalcula custo por cliente, lucro por cliente, relação com a faixa e meses para se pagar, com "estimado por faixa" |
| CAP-dm-unit-economics | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/unit/unitEconomics.test.ts | Números de G1–G4, arredondamento, BR-dm-14, BR-dm-15 |
| CAP-dm-unit-economics | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/unit/money.test.ts | Formatação, leitura e cursor da máscara |
| CAP-dm-unit-economics | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/e2e/calculator.spec.ts | AC-dm-15 e AC-dm-51 na tela real; nenhum "NaN", "Infinity" ou valor vazio |
| CAP-dm-engine | create | Sem código de domínio; regras e conteúdo v1 só no PRD (`## Conteúdo metodológico v1`) | shared/rules/rulesV1.ts | `RULES_VERSION = 1`, limiares, pontos médios, multiplicadores, faixas da relação, P × I dos sinais e desempate do plano num único objeto `Rules`; uma versão nova é outro arquivo, nunca edição deste |
| CAP-dm-engine | create | Sem código de domínio; regras e conteúdo v1 só no PRD (`## Conteúdo metodológico v1`) | shared/content/stageContent.ts | Nomes e frases dos estágios, nomes e perguntas das dimensões, texto das etapas de pesquisa do estágio 1 e frase do último degrau |
| CAP-dm-engine | create | Sem código de domínio; regras e conteúdo v1 só no PRD (`## Conteúdo metodológico v1`) | shared/content/riskCatalog.ts | Títulos e "Como reduzir" de SIG-01 a SIG-08 |
| CAP-dm-engine | create | Sem código de domínio; regras e conteúdo v1 só no PRD (`## Conteúdo metodológico v1`) | shared/content/actionCatalog.ts | As 14 ações com título, motivo e como fazer |
| CAP-dm-engine | create | Sem código de domínio; regras e conteúdo v1 só no PRD (`## Conteúdo metodológico v1`) | shared/domain/types.ts | Tipos de respostas, entrada da calculadora e resultado congelado |
| CAP-dm-engine | create | RULE-dm-01, RULE-dm-02, RULE-dm-06 | shared/domain/dimensionScores.ts | Notas das 8 dimensões e o estágio que cada uma sustentaria |
| CAP-dm-engine | create | RULE-dm-04, RULE-dm-05 | shared/domain/stageGate.ts | Estágio e trava |
| CAP-dm-engine | create | RULE-dm-07 | shared/domain/riskSignals.ts | Riscos do catálogo, ordenação e limite de 5 |
| CAP-dm-engine | create | RULE-dm-08 | shared/domain/confidence.ts | Confiança alta, média ou baixa |
| CAP-dm-engine | create | RULE-dm-09, RULE-dm-10 | shared/domain/actionPlan.ts | Plano de 3 ações com a ordem e o desempate do PRD |
| CAP-dm-engine | create | RULE-dm-11 | shared/domain/evaluateDiagnosis.ts | `evaluateDiagnosis(input, rules)` puro, devolvendo o resultado com `rulesVersion` |
| CAP-dm-engine | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/fixtures/rulesV2.ts | Variante de teste das regras (versão 2, um limiar diferente) para AC-dm-22 e AC-dm-31 |
| CAP-dm-engine | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/unit/evaluateDiagnosis.test.ts | G1–G4 exatos (notas, estágio, trava, riscos, plano e confiança); `invest` só com custo medido e confiança alta; mesmo estágio com dimensões fracas diferentes → planos diferentes |
| CAP-dm-engine | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/unit/diagnosisRules.test.ts | Módulos de regra testados direto: custo estimado bloqueando o estágio 3, AC-dm-19/21/23/24/49, BR-dm-13/14/15 |
| CAP-dm-result | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/result/ResultPage.tsx | Em camadas: escada, trava em itálico, 3 ações e aviso de orientação; abaixo, encaixes, frentes, números, riscos e confiança; estados carregando e erro |
| CAP-dm-result | create | Assinatura do protótipo (escada com trava sobre a pauta) | src/features/result/StageLadder.tsx | Degrau anterior tracejado, cadeado no próximo, descrição acessível da AC-dm-28; reutilizada pela tela inicial |
| CAP-dm-result | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/result/ActionPlanList.tsx | As 3 ações com título, motivo e como fazer |
| CAP-dm-result | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/result/DimensionScores.tsx | Barras com "Sustentaria o estágio N" e "Abaixo de 50"; revelação por IntersectionObserver desligada com movimento reduzido |
| CAP-dm-result | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/result/RiskList.tsx | Riscos com P, I, nota, nível e "Como reduzir:"; "Nenhum risco encontrado nas suas respostas" |
| CAP-dm-result | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/result/NumbersSummary.tsx | CAC, LTV, relação e payback com a origem |
| CAP-dm-result | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/result/ConfidenceNote.tsx | "Confiança nos dados: …" e o aviso de resultado provisório |
| CAP-dm-result | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/unit/forbiddenTerms.test.ts | Varre os textos de `shared/content/` atrás de V1–V4, "Método V4", "V4 Company", PPA, CREP e "vacinas" |
| CAP-dm-result | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/e2e/result.spec.ts | Conclui pela interface e confere camadas, descrição da escada, riscos e estado sem risco, confiança, varredura do texto renderizado, movimento reduzido, 390 px, axe e o tempo até o resultado |
| CAP-dm-history | create | RULE-dm-11 | shared/domain/compareDiagnoses.ts | Estágio antes → depois, diferença por dimensão, riscos resolvidos e novos; com versões diferentes, recalcula o anterior com as regras atuais a partir das respostas guardadas e mantém a nota original |
| CAP-dm-history | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/routes/historyRoutes.ts | `GET /api/companies/:id/timeline`, `POST /api/diagnoses/:id/archive`, `POST /api/diagnoses/:id/restore`, `GET /api/diagnoses/:id/comparison` |
| CAP-dm-history | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/services/historyService.ts | Linha do tempo, arquivar/restaurar diagnóstico concluído e comparação com o anterior não arquivado |
| CAP-dm-history | create | Arquivo criado na Fase 1 (ausente no Gate C) | server/app.ts | Monta `historyRoutes` |
| CAP-dm-history | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/api/historyApi.ts | Chamadas da linha do tempo e da comparação |
| CAP-dm-history | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/history/CompanyTimeline.tsx | Rascunho com progresso, concluídos com estágio, versão do cálculo e confiança, arquivados recolhidos; arquivar/restaurar com ConfirmDialog |
| CAP-dm-history | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/history/ComparePage.tsx | `#/comparar/:id` com setas e texto nas diferenças e o aviso de recálculo |
| CAP-dm-history | create | Arquivo criado na Fase 1 (ausente no Gate C) | src/features/companies/CompanyPage.tsx | Mostra a CompanyTimeline |
| CAP-dm-history | create | Arquivo criado na Fase 1 (ausente no Gate C) | src/features/result/ResultPage.tsx | "Comparar com {mês}" só quando há concluído anterior (BR-dm-08) |
| CAP-dm-history | create | Arquivo criado na Fase 1 (ausente no Gate C) | src/App.tsx | Rota `#/comparar/:id` |
| CAP-dm-history | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/unit/compareDiagnoses.test.ts | Diferenças, riscos resolvidos e novos e recálculo com `tests/fixtures/rulesV2.ts` |
| CAP-dm-history | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/api/historyRoutes.test.ts | Linha do tempo, arquivar e restaurar diagnóstico, comparação e primeiro diagnóstico sem comparação |
| CAP-dm-history | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/e2e/history.spec.ts | Segundo diagnóstico a partir do primeiro, comparação, arquivar/restaurar confirmando e cancelando |
| CAP-dm-report | create | OQ-4: o webview filho do app não tem tratador de download (`draft_window.rs` `embed_app_webview`) | server/files/downloadsFolder.ts | Pasta `<home>/Downloads` (criada se faltar), nome saneado (sem separadores nem caracteres reservados, até 80 caracteres), sufixo " (2)" se já existir, grava em temporário e renomeia; pasta injetada nos testes |
| CAP-dm-report | create | AC-dm-36 | server/report/reportModel.ts | Conteúdo puro: empresa, data, versão do cálculo, confiança, estágio, trava, 8 notas, riscos, 3 ações e aviso de orientação |
| CAP-dm-report | create | RULE-dm-19 | server/report/pdfRenderer.ts | pdfkit A4 com Inter e JetBrains Mono embutidas a partir dos arquivos instalados de `@fontsource`; nenhuma rede |
| CAP-dm-report | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/services/reportService.ts | Monta o modelo, gera o PDF e salva com o nome `{empresa}-{data}.pdf` |
| CAP-dm-report | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/routes/reportRoutes.ts | `POST /api/diagnoses/:id/report` → `{ fileName, directory }`; só para concluído |
| CAP-dm-report | create | Arquivo criado na Fase 1 (ausente no Gate C) | server/app.ts | Monta `reportRoutes` |
| CAP-dm-report | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/api/reportApi.ts | Chamada de exportação |
| CAP-dm-report | create | Modal `pdf-modal` do protótipo | src/features/result/ExportReportDialog.tsx | Exporta e mostra onde o arquivo foi salvo; falha em `role="alert"` com o resultado intacto |
| CAP-dm-report | create | Arquivo criado na Fase 1 (ausente no Gate C) | src/features/result/ResultPage.tsx | Botão "Exportar PDF" |
| CAP-dm-report | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/unit/reportModel.test.ts | Todos os campos da AC-dm-36 e nenhum termo proibido |
| CAP-dm-report | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/api/reportRoutes.test.ts | PDF gravado na pasta temporária, texto extraído com `unpdf` com todos os campos, nomes hostis (`../`, `CON`, `:*?`) ficam dentro da pasta, rascunho → 409, falha de gravação → erro sem arquivo |
| CAP-dm-report | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/e2e/report.spec.ts | Exporta pela interface e confere a mensagem e o arquivo na pasta temporária |
| CAP-dm-home | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/routes/homeRoutes.ts | `GET /api/home?mode=owner\|consultant&companyId=` |
| CAP-dm-home | create | Regra `management-home-widgets` | server/services/homeService.ts | Modo empresa: escada, data, trava, ações, rascunho e série da pontuação média; modo consultoria: empresas por estágio, rascunhos parados há mais de 7 dias, sem concluído há mais de 90 dias, com risco alto (≥ 16) e sem diagnóstico; `now` injetado |
| CAP-dm-home | create | Arquivo criado na Fase 1 (ausente no Gate C) | server/app.ts | Monta `homeRoutes` |
| CAP-dm-home | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/api/homeApi.ts | Chamada da tela inicial |
| CAP-dm-home | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/home/HomePage.tsx | `#/inicio`: escolhe a tela pelo modo; estados vazios da AC-dm-35 |
| CAP-dm-home | create | AC-dm-32 | src/features/home/OwnerHome.tsx | Escada da empresa em foco, trava, 3 ações, "Continuar de onde parei" e evolução com link para comparar |
| CAP-dm-home | create | AC-dm-34 | src/features/home/ConsultantHome.tsx | Carteira por estágio com link para `#/empresas?estagio=N` e listas de atenção com link para as empresas |
| CAP-dm-home | create | Regra `management-home-widgets` | src/features/home/ScoreTrend.tsx | Linha em SVG dos dados reais com eixo rotulado e resumo em uma frase |
| CAP-dm-home | create | Arquivo criado na Fase 1 (ausente no Gate C) | src/App.tsx | Rota `#/inicio` |
| CAP-dm-home | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/api/homeRoutes.test.ts | Indicadores mudam depois de concluir e arquivar (AC-dm-33); limites de 7 e 90 dias com relógio injetado |
| CAP-dm-home | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/e2e/home.spec.ts | AC-dm-32 a AC-dm-35 nos dois modos, links filtrados, movimento reduzido, 390 px |
| CAP-dm-settings | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/routes/preferenceRoutes.ts | `GET/PUT /api/preferences` |
| CAP-dm-settings | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/services/preferenceService.ts | Lê e grava as preferências |
| CAP-dm-settings | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/repositories/preferenceRepository.ts | Tabela `preferences` (chave e valor) |
| CAP-dm-settings | create | SEC-SBD-01 | server/validation/preferenceSchemas.ts | Modo `owner\|consultant`, empresa em foco ativa e existente, tema `dark\|light`, tour visto por modo |
| CAP-dm-settings | create | Arquivo criado na Fase 1 (ausente no Gate C) | server/app.ts | Monta `preferenceRoutes` |
| CAP-dm-settings | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/api/preferencesApi.ts | Chamadas das preferências |
| CAP-dm-settings | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/preferences/PreferencesProvider.tsx | Carrega antes da primeira tela, aplica `data-theme` no `<html>` e grava cada troca |
| CAP-dm-settings | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/settings/SettingsPage.tsx | `#/configuracoes`: modo, empresa em foco, tema; "Como ler os resultados"; "O que o assistente do Play pode ler" com exatamente os campos da RULE-dm-17; nota de segurança (OQ-6) |
| CAP-dm-settings | create | Arquivo criado na Fase 1 (ausente no Gate C) | src/components/layout/AppShell.tsx | Navegação Início, Empresas e Configurações conforme o modo (BR-dm-09) |
| CAP-dm-settings | create | Arquivo criado na Fase 1 (ausente no Gate C) | src/main.tsx | Envolve o app no PreferencesProvider |
| CAP-dm-settings | create | Arquivo criado na Fase 1 (ausente no Gate C) | src/App.tsx | Rota `#/configuracoes` |
| CAP-dm-settings | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/api/preferenceRoutes.test.ts | Gravação, leitura e valores inválidos |
| CAP-dm-settings | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/e2e/settings.spec.ts | Troca de modo, empresa em foco e tema valendo na hora e depois de recarregar; textos da AC-dm-39 |
| CAP-dm-settings | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/e2e/accessibility.spec.ts | Todas as rotas nos dois temas em 390 px: sem rolagem horizontal, alvos ≥ 44 px, foco visível pelo teclado, contraste pelo axe; movimento reduzido no estado final |
| CAP-dm-first-run | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/firstRun/WelcomeModePage.tsx | `#/boas-vindas`: "Vamos descobrir em que degrau a sua empresa está" e escolha do modo |
| CAP-dm-first-run | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/firstRun/WelcomeCompanyPage.tsx | `#/boas-vindas/empresa`: cadastro mínimo; "Começar o diagnóstico" cria a empresa, grava modo e empresa em foco, inicia o rascunho e abre "Seus números" |
| CAP-dm-first-run | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/home/OnboardingTour.tsx | 5 passos no modo empresa e 4 no modo consultoria sobre as regiões `data-aioson-tour`; "Pular o tour"; reabre pelo "?" |
| CAP-dm-first-run | create | Arquivo criado na Fase 1 (ausente no Gate C) | src/components/layout/AppShell.tsx | Botão "?" que reabre o tour |
| CAP-dm-first-run | create | Arquivo criado na Fase 1 (ausente no Gate C) | src/App.tsx | `/` sem empresas → `#/boas-vindas` (BR-dm-11); com empresas → `#/inicio` |
| CAP-dm-first-run | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/e2e/firstRun.spec.ts | No projeto `fresh-db`: abre no assistente sem nenhuma tela técnica, cria empresa e cai em "Seus números", tour com 5/4 passos, pular e reabrir |
| CAP-dm-backup | create | SEC-SBD-01 e SEC-SBD-02 (`security-baseline.md`) | server/validation/backupSchemas.ts | Marca `format: "fitpulse-backup"`, `formatVersion`, `schemaVersion`, `rulesVersion`, empresas e diagnósticos com os mesmos limites da API |
| CAP-dm-backup | create | RULE-dm-18 | server/services/backupService.ts | Exporta tudo para `fitpulse-copia-{data}.json` pela `downloadsFolder`; importa recusando versão mais nova (mensagem da F-06) e arquivo inválido; insere numa transação pulando ids existentes e devolve as contagens |
| CAP-dm-backup | create | Sem `server/` na raiz; padrão irmão `C:/dev/playapps/flow-deck/package.json` (tsx + vite via concurrently) | server/routes/backupRoutes.ts | `POST /api/backup/export` e `POST /api/backup/import` (limite de 10 MB só nesta rota) |
| CAP-dm-backup | create | Arquivo criado na Fase 1 (ausente no Gate C) | server/app.ts | Monta `backupRoutes` |
| CAP-dm-backup | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/api/backupApi.ts | Chamadas da cópia de segurança |
| CAP-dm-backup | create | Sem `src/` na raiz; composição no protótipo aprovado `.aioson/briefings/diagnostico-maturidade/prototype.html` | src/features/settings/BackupSection.tsx | "Exportar meus dados" e "Importar uma cópia" (`<input type="file">` lido como texto e enviado em JSON); sucesso e erro em `role="alert"`; aviso de que desinstalar apaga os dados deste computador (OQ-3) |
| CAP-dm-backup | create | Arquivo criado na Fase 3 (ausente no Gate C) | src/features/settings/SettingsPage.tsx | Mostra a BackupSection |
| CAP-dm-backup | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/api/backupRoutes.test.ts | Ida e volta para um banco novo reproduz empresas, diagnósticos e resultados; importar duas vezes não duplica; versão mais nova e arquivo inválido recusados sem mudar nada |
| CAP-dm-backup | create | `aioson detect:test-runner` → nenhum runner; sem `tests/` | tests/e2e/backup.spec.ts | Exportar e importar pela interface, recusa com `role="alert"` |

## Capability Delivery Plan

| CAP | Phase | Files | Verification |
|---|---|---|---|
| CAP-dm-play-runtime | 1 | manifest.json, system.json, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, .gitignore, tsconfig.json, vite.config.ts, index.html, prisma.config.ts, prisma/schema.prisma, prisma/migrations/migration_lock.toml, prisma/migrations/20261023000000_init/migration.sql, scripts/prepare-app.mjs, scripts/smoke-migrate.mjs, scripts/smoke-boot.mjs, scripts/smoke-store-package.mjs, server/main.ts, server/app.ts, server/db/databaseUrl.ts, server/db/prismaClient.ts, server/http/requestGuards.ts, server/http/errorHandler.ts, server/routes/playRoutes.ts, server/services/assistantSummaryService.ts, src/main.tsx, src/App.tsx, src/styles/tokens.css, src/styles/global.css, src/components/layout/AppShell.tsx, vitest.config.ts, playwright.config.ts, tests/helpers/testDatabase.ts, tests/api/playRoutes.test.ts, tests/e2e/global-setup.ts, tests/e2e/support/fixtures.ts, tests/e2e/shell.spec.ts, .aioson/plans/diagnostico-maturidade/harness-contract.json | `pnpm build` + `node scripts/smoke-migrate.mjs` + `node scripts/smoke-boot.mjs` + `node scripts/smoke-store-package.mjs` + `pnpm test -- tests/api/playRoutes.test.ts` + `pnpm test:e2e -- tests/e2e/shell.spec.ts` + dev-link no Play |
| CAP-dm-company | 1 | components.json, src/lib/utils.ts, src/components/ui/button.tsx, src/components/ui/alert-dialog.tsx, src/components/ui/input.tsx, src/components/ui/label.tsx, src/components/feedback/ConfirmDialog.tsx, src/components/feedback/StatusView.tsx, src/components/form/TextField.tsx, src/components/form/CnpjField.tsx, shared/format/cnpj.ts, shared/content/companyOptions.ts, src/api/httpClient.ts, src/api/companiesApi.ts, src/features/companies/CompaniesPage.tsx, src/features/companies/CompanyFormDialog.tsx, src/features/companies/CompanyPage.tsx, server/routes/companyRoutes.ts, server/services/companyService.ts, server/services/domainError.ts, server/repositories/companyRepository.ts, server/validation/companySchemas.ts, tests/unit/cnpj.test.ts, tests/api/companyRoutes.test.ts, tests/e2e/companies.spec.ts | `pnpm test -- tests/unit/cnpj.test.ts tests/api/companyRoutes.test.ts` + `pnpm test:e2e -- tests/e2e/companies.spec.ts` |
| CAP-dm-questionnaire | 1 | shared/content/questionBank.ts, shared/domain/completeness.ts, src/api/diagnosesApi.ts, src/features/diagnosis/QuestionnairePage.tsx, src/features/diagnosis/BlockRail.tsx, src/features/diagnosis/AnchoredQuestion.tsx, src/features/diagnosis/useDraftAutosave.ts, src/features/diagnosis/CompletionGate.tsx, server/routes/diagnosisRoutes.ts, server/services/diagnosisService.ts, server/repositories/diagnosisRepository.ts, server/validation/diagnosisSchemas.ts, tests/unit/questionBank.test.ts, tests/api/diagnosisRoutes.test.ts, tests/e2e/questionnaire.spec.ts | `pnpm test -- tests/unit/questionBank.test.ts tests/api/diagnosisRoutes.test.ts` + `pnpm test:e2e -- tests/e2e/questionnaire.spec.ts` |
| CAP-dm-unit-economics | 1 | shared/content/calculatorOptions.ts, shared/domain/unitEconomics.ts, shared/format/money.ts, shared/format/displayNumbers.ts, src/components/form/MoneyField.tsx, src/features/diagnosis/CalculatorBlock.tsx, src/features/diagnosis/UnitEconomicsPanel.tsx, tests/unit/unitEconomics.test.ts, tests/unit/money.test.ts, tests/e2e/calculator.spec.ts | `pnpm test -- tests/unit/unitEconomics.test.ts tests/unit/money.test.ts` + `pnpm test:e2e -- tests/e2e/calculator.spec.ts` |
| CAP-dm-engine | 1 | shared/rules/rulesV1.ts, shared/content/stageContent.ts, shared/content/riskCatalog.ts, shared/content/actionCatalog.ts, shared/domain/types.ts, shared/domain/dimensionScores.ts, shared/domain/stageGate.ts, shared/domain/riskSignals.ts, shared/domain/confidence.ts, shared/domain/actionPlan.ts, shared/domain/evaluateDiagnosis.ts, tests/fixtures/rulesV2.ts, tests/unit/evaluateDiagnosis.test.ts, tests/unit/diagnosisRules.test.ts | `pnpm test -- tests/unit/diagnosisRules.test.ts tests/unit/evaluateDiagnosis.test.ts tests/api/diagnosisRoutes.test.ts` |
| CAP-dm-result | 1 | src/features/result/ResultPage.tsx, src/features/result/StageLadder.tsx, src/features/result/ActionPlanList.tsx, src/features/result/DimensionScores.tsx, src/features/result/RiskList.tsx, src/features/result/NumbersSummary.tsx, src/features/result/ConfidenceNote.tsx, tests/unit/forbiddenTerms.test.ts, tests/e2e/result.spec.ts | `pnpm test -- tests/unit/forbiddenTerms.test.ts` + `pnpm test:e2e -- tests/e2e/result.spec.ts` |
| CAP-dm-history | 2 | shared/domain/compareDiagnoses.ts, server/routes/historyRoutes.ts, server/services/historyService.ts, server/app.ts, src/api/historyApi.ts, src/features/history/CompanyTimeline.tsx, src/features/history/ComparePage.tsx, src/features/companies/CompanyPage.tsx, src/features/result/ResultPage.tsx, src/App.tsx, tests/unit/compareDiagnoses.test.ts, tests/api/historyRoutes.test.ts, tests/e2e/history.spec.ts | `pnpm test -- tests/unit/compareDiagnoses.test.ts tests/api/historyRoutes.test.ts` + `pnpm test:e2e -- tests/e2e/history.spec.ts` |
| CAP-dm-report | 2 | server/files/downloadsFolder.ts, server/report/reportModel.ts, server/report/pdfRenderer.ts, server/services/reportService.ts, server/routes/reportRoutes.ts, server/app.ts, src/api/reportApi.ts, src/features/result/ExportReportDialog.tsx, src/features/result/ResultPage.tsx, tests/unit/reportModel.test.ts, tests/api/reportRoutes.test.ts, tests/e2e/report.spec.ts | `pnpm test -- tests/unit/reportModel.test.ts tests/api/reportRoutes.test.ts` + `pnpm test:e2e -- tests/e2e/report.spec.ts` + exportar no webview do Play |
| CAP-dm-home | 3 | server/routes/homeRoutes.ts, server/services/homeService.ts, server/app.ts, src/api/homeApi.ts, src/features/home/HomePage.tsx, src/features/home/OwnerHome.tsx, src/features/home/ConsultantHome.tsx, src/features/home/ScoreTrend.tsx, src/App.tsx, tests/api/homeRoutes.test.ts, tests/e2e/home.spec.ts | `pnpm test -- tests/api/homeRoutes.test.ts` + `pnpm test:e2e -- tests/e2e/home.spec.ts` |
| CAP-dm-settings | 3 | server/routes/preferenceRoutes.ts, server/services/preferenceService.ts, server/repositories/preferenceRepository.ts, server/validation/preferenceSchemas.ts, server/app.ts, src/api/preferencesApi.ts, src/features/preferences/PreferencesProvider.tsx, src/features/settings/SettingsPage.tsx, src/components/layout/AppShell.tsx, src/main.tsx, src/App.tsx, tests/api/preferenceRoutes.test.ts, tests/e2e/settings.spec.ts, tests/e2e/accessibility.spec.ts | `pnpm test -- tests/api/preferenceRoutes.test.ts` + `pnpm test:e2e -- tests/e2e/settings.spec.ts tests/e2e/accessibility.spec.ts` |
| CAP-dm-first-run | 3 | src/features/firstRun/WelcomeModePage.tsx, src/features/firstRun/WelcomeCompanyPage.tsx, src/features/home/OnboardingTour.tsx, src/components/layout/AppShell.tsx, src/App.tsx, tests/e2e/firstRun.spec.ts | `pnpm test:e2e -- tests/e2e/firstRun.spec.ts` + abertura sem dados no dev-link do Play |
| CAP-dm-backup | 4 | server/validation/backupSchemas.ts, server/services/backupService.ts, server/routes/backupRoutes.ts, server/app.ts, src/api/backupApi.ts, src/features/settings/BackupSection.tsx, src/features/settings/SettingsPage.tsx, tests/api/backupRoutes.test.ts, tests/e2e/backup.spec.ts | `pnpm test -- tests/api/backupRoutes.test.ts` + `pnpm test:e2e -- tests/e2e/backup.spec.ts` + regressão completa da Fase 4 |

## Phase 1 — O dono abre o FitPulse no Play, cadastra a empresa, responde o diagnóstico e vê o resultado

- CAP/AC:
  - CAP-dm-play-runtime: AC-dm-40, AC-dm-41, AC-dm-42, AC-dm-43, AC-dm-44, AC-dm-45, AC-dm-50.
  - CAP-dm-company: AC-dm-04, AC-dm-05, AC-dm-06, AC-dm-07, AC-dm-08, AC-dm-09, AC-dm-17.
  - CAP-dm-questionnaire: AC-dm-10, AC-dm-11, AC-dm-12, AC-dm-13, AC-dm-14, AC-dm-16.
  - CAP-dm-unit-economics: AC-dm-15, AC-dm-51.
  - CAP-dm-engine: AC-dm-18, AC-dm-19, AC-dm-20, AC-dm-21, AC-dm-22, AC-dm-23, AC-dm-24, AC-dm-25, AC-dm-26, AC-dm-27, AC-dm-49.
  - CAP-dm-result: AC-dm-28, AC-dm-29.
  - Nas telas desta fase: AC-dm-46, AC-dm-47, AC-dm-48.
  - Interações do protótipo: `company-create`, `company-edit`, `company-archive`, `company-restore`, `company-delete`, `diagnosis-start-from-previous`, `diagnosis-answer-anchored-item`, `diagnosis-dont-know-range`, `diagnosis-autosave-resume`, `diagnosis-discard-draft`, `cac-ltv-calculator`, `diagnosis-complete`, `result-layered-view`.
- User-visible outcome: no dev-link do Play, o FitPulse abre em `127.0.0.1` com a marca FitPulse e sem login.
  - Em "Empresas", o dono cadastra, edita, busca, filtra, arquiva, restaura e exclui.
  - Na página da empresa, ele começa o diagnóstico. Cada resposta e cada valor da calculadora ficam gravados, e o rascunho volta depois de fechar o app.
  - "Ver meu resultado" passa pelo portão em ouro e mostra o resultado em camadas, calculado pelas regras v1.
- Implementation, nesta ordem:
  1. **Instalação e runtime primeiro**, para tirar logo o risco de instalação:
     - `package.json`, `pnpm-workspace.yaml`, as configurações, `manifest.json` e `system.json`;
     - schema e migration inicial;
     - `scripts/prepare-app.mjs`;
     - `server/main.ts`, `server/app.ts`, as guardas e `playRoutes`;
     - casca da interface com tokens e fontes.
     - Pronto quando: `pnpm install` limpo, os três smokes passam e o dev-link do Play mostra a casca.
  2. **Domínio puro, com os testes antes do código:** `rulesV1`, conteúdo, `unitEconomics` e `evaluateDiagnosis`. G1–G4 e os casos de borda passam antes de qualquer tela usar o motor.
  3. **Empresas:** API, repositório e telas.
  4. **Questionário, calculadora e gravação automática.**
  5. **Conclusão e resultado** e as specs e2e.
  6. **Contrato de runtime:** criar `.aioson/plans/diagnostico-maturidade/harness-contract.json` com os critérios abaixo e rodar `aioson harness:check . --slug=diagnostico-maturidade`:
     - RG-build: `pnpm build`;
     - RG-migrate: `node scripts/smoke-migrate.mjs`;
     - RG-boot: `node scripts/smoke-boot.mjs`;
     - RG-smoke: `pnpm test:e2e`, cobrindo as interações Core do protótipo;
     - C-unit: `pnpm test`;
     - C-package: `node scripts/smoke-store-package.mjs`.
  - Esquema:
    - `companies`: id, name, segment, sales_channel, annual_revenue_range?, cnpj? (14 dígitos), archived_at?, created_at, updated_at.
    - `diagnoses`: id, company_id (FK em cascata), status `draft|completed`, archived_at?, answers (JSON), calculator (JSON, dinheiro em centavos inteiros), current_block, rules_version?, result (JSON congelado)?, stage?, completed_at?, created_at, updated_at; índice (company_id, status).
    - `preferences`: key, value.
  - Textos, estados e composição seguem o protótipo aprovado, com os desvios 1, 2, 3, 4 e 5 do `## Prototype contract` do PRD.
- Create/modify/reuse/retire:
  - CAP-dm-play-runtime: modify `manifest.json`; create `system.json`; create `package.json`; create `pnpm-workspace.yaml`; create `pnpm-lock.yaml`; modify `.gitignore`; create `tsconfig.json`; create `vite.config.ts`; create `index.html`; create `prisma.config.ts`; create `prisma/schema.prisma`; create `prisma/migrations/migration_lock.toml`; create `prisma/migrations/20261023000000_init/migration.sql`; create `scripts/prepare-app.mjs`; create `scripts/smoke-migrate.mjs`; create `scripts/smoke-boot.mjs`; create `scripts/smoke-store-package.mjs`; create `server/main.ts`; create `server/app.ts`; create `server/db/databaseUrl.ts`; create `server/db/prismaClient.ts`; create `server/http/requestGuards.ts`; create `server/http/errorHandler.ts`; create `server/routes/playRoutes.ts`; create `server/services/assistantSummaryService.ts`; create `src/main.tsx`; create `src/App.tsx`; create `src/styles/tokens.css`; create `src/styles/global.css`; create `src/components/layout/AppShell.tsx`; create `vitest.config.ts`; create `playwright.config.ts`; create `tests/helpers/testDatabase.ts`; create `tests/api/playRoutes.test.ts`; create `tests/e2e/global-setup.ts`; create `tests/e2e/support/fixtures.ts`; create `tests/e2e/shell.spec.ts`; create `.aioson/plans/diagnostico-maturidade/harness-contract.json`
  - CAP-dm-company: create `components.json`; create `src/lib/utils.ts`; create `src/components/ui/button.tsx`; create `src/components/ui/alert-dialog.tsx`; create `src/components/ui/input.tsx`; create `src/components/ui/label.tsx`; create `src/components/feedback/ConfirmDialog.tsx`; create `src/components/feedback/StatusView.tsx`; create `src/components/form/TextField.tsx`; create `src/components/form/CnpjField.tsx`; create `shared/format/cnpj.ts`; create `shared/content/companyOptions.ts`; create `src/api/httpClient.ts`; create `src/api/companiesApi.ts`; create `src/features/companies/CompaniesPage.tsx`; create `src/features/companies/CompanyFormDialog.tsx`; create `src/features/companies/CompanyPage.tsx`; create `server/routes/companyRoutes.ts`; create `server/services/companyService.ts`; create `server/services/domainError.ts`; create `server/repositories/companyRepository.ts`; create `server/validation/companySchemas.ts`; create `tests/unit/cnpj.test.ts`; create `tests/api/companyRoutes.test.ts`; create `tests/e2e/companies.spec.ts`
  - CAP-dm-questionnaire: create `shared/content/questionBank.ts`; create `shared/domain/completeness.ts`; create `src/api/diagnosesApi.ts`; create `src/features/diagnosis/QuestionnairePage.tsx`; create `src/features/diagnosis/BlockRail.tsx`; create `src/features/diagnosis/AnchoredQuestion.tsx`; create `src/features/diagnosis/useDraftAutosave.ts`; create `src/features/diagnosis/CompletionGate.tsx`; create `server/routes/diagnosisRoutes.ts`; create `server/services/diagnosisService.ts`; create `server/repositories/diagnosisRepository.ts`; create `server/validation/diagnosisSchemas.ts`; create `tests/unit/questionBank.test.ts`; create `tests/api/diagnosisRoutes.test.ts`; create `tests/e2e/questionnaire.spec.ts`
  - CAP-dm-unit-economics: create `shared/content/calculatorOptions.ts`; create `shared/domain/unitEconomics.ts`; create `shared/format/money.ts`; create `shared/format/displayNumbers.ts`; create `src/components/form/MoneyField.tsx`; create `src/features/diagnosis/CalculatorBlock.tsx`; create `src/features/diagnosis/UnitEconomicsPanel.tsx`; create `tests/unit/unitEconomics.test.ts`; create `tests/unit/money.test.ts`; create `tests/e2e/calculator.spec.ts`
  - CAP-dm-engine: create `shared/rules/rulesV1.ts`; create `shared/content/stageContent.ts`; create `shared/content/riskCatalog.ts`; create `shared/content/actionCatalog.ts`; create `shared/domain/types.ts`; create `shared/domain/dimensionScores.ts`; create `shared/domain/stageGate.ts`; create `shared/domain/riskSignals.ts`; create `shared/domain/confidence.ts`; create `shared/domain/actionPlan.ts`; create `shared/domain/evaluateDiagnosis.ts`; create `tests/fixtures/rulesV2.ts`; create `tests/unit/evaluateDiagnosis.test.ts`; create `tests/unit/diagnosisRules.test.ts`
  - CAP-dm-result: create `src/features/result/ResultPage.tsx`; create `src/features/result/StageLadder.tsx`; create `src/features/result/ActionPlanList.tsx`; create `src/features/result/DimensionScores.tsx`; create `src/features/result/RiskList.tsx`; create `src/features/result/NumbersSummary.tsx`; create `src/features/result/ConfidenceNote.tsx`; create `tests/unit/forbiddenTerms.test.ts`; create `tests/e2e/result.spec.ts`
- Verification:
  - Comandos: `pnpm install` (limpo), `pnpm typecheck`, `pnpm test`, `pnpm build`, `node scripts/smoke-migrate.mjs`, `node scripts/smoke-boot.mjs`, `pnpm test:e2e`, `node scripts/smoke-store-package.mjs` e `aioson harness:check . --slug=diagnostico-maturidade`.
  - No Play (Settings → Instalar App → Linkar pasta): o webview mostra o FitPulse e o badge fica verde.
  - Concluir um diagnóstico no Play e medir até 3 s até o resultado (AC-dm-27).
- Done when: no dev-link do Play, uma empresa cadastrada conclui um diagnóstico e o resultado aparece com estágio, trava, 3 ações, riscos e confiança. Além disso, `pnpm test`, `pnpm test:e2e`, os três smokes e `aioson harness:check` saem com código 0.

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

## Phase 3 — A tela inicial orienta a próxima decisão nos dois modos, com assistente de primeiro uso, tour e configurações

- CAP/AC:
  - CAP-dm-home: AC-dm-32, AC-dm-33, AC-dm-34, AC-dm-35.
  - CAP-dm-first-run: AC-dm-01, AC-dm-02, AC-dm-03.
  - CAP-dm-settings: AC-dm-38, AC-dm-39.
  - Nas telas desta fase e na varredura de todas as rotas: AC-dm-46, AC-dm-47.
  - Interações do protótipo: `wizard-choose-mode`, `wizard-create-company`, `switch-usage-mode`, `tour-reopen`, `switch-theme`.
- User-visible outcome:
  - Sem empresas, o app abre no assistente, e o assistente leva até "Seus números".
  - A tela inicial mostra a empresa em foco (modo empresa) ou a carteira por estágio e as listas de atenção (modo consultoria). Cada indicador leva à lista filtrada.
  - O tour aparece na primeira abertura e reabre pelo "?".
  - Configurações troca modo, empresa em foco e tema, e as escolhas continuam depois de fechar o app.
- Implementation:
  - Preferências (repositório, serviço, rotas, provider que aplica o tema antes da primeira tela).
  - `homeService` com relógio injetado e `homeRoutes`.
  - Telas inicial, assistente e tour.
  - Configurações.
  - Rota raiz decide entre assistente e tela inicial.
  - Varredura de acessibilidade de todas as rotas.
- Create/modify/reuse/retire:
  - CAP-dm-home: create `server/routes/homeRoutes.ts`; create `server/services/homeService.ts`; create `server/app.ts`; create `src/api/homeApi.ts`; create `src/features/home/HomePage.tsx`; create `src/features/home/OwnerHome.tsx`; create `src/features/home/ConsultantHome.tsx`; create `src/features/home/ScoreTrend.tsx`; create `src/App.tsx`; create `tests/api/homeRoutes.test.ts`; create `tests/e2e/home.spec.ts`
  - CAP-dm-settings: create `server/routes/preferenceRoutes.ts`; create `server/services/preferenceService.ts`; create `server/repositories/preferenceRepository.ts`; create `server/validation/preferenceSchemas.ts`; create `server/app.ts`; create `src/api/preferencesApi.ts`; create `src/features/preferences/PreferencesProvider.tsx`; create `src/features/settings/SettingsPage.tsx`; create `src/components/layout/AppShell.tsx`; create `src/main.tsx`; create `src/App.tsx`; create `tests/api/preferenceRoutes.test.ts`; create `tests/e2e/settings.spec.ts`; create `tests/e2e/accessibility.spec.ts`
  - CAP-dm-first-run: create `src/features/firstRun/WelcomeModePage.tsx`; create `src/features/firstRun/WelcomeCompanyPage.tsx`; create `src/features/home/OnboardingTour.tsx`; create `src/components/layout/AppShell.tsx`; create `src/App.tsx`; create `tests/e2e/firstRun.spec.ts`
- Verification:
  - Testes da fase: `pnpm test -- tests/api/homeRoutes.test.ts tests/api/preferenceRoutes.test.ts` e `pnpm test:e2e -- tests/e2e/firstRun.spec.ts tests/e2e/home.spec.ts tests/e2e/settings.spec.ts tests/e2e/accessibility.spec.ts`.
  - Regressão: `pnpm test` e `pnpm test:e2e` completos.
  - No dev-link do Play, com `data/` apagado: o app abre no assistente.
- Done when:
  - No Play, sem dados, o app abre no assistente e termina em "Seus números".
  - Depois de concluir, a tela inicial mostra os números reais nos dois modos.
  - Tema e modo continuam depois de reabrir.
  - As suítes completas saem com código 0.

## Phase 4 — Cópia de segurança e entrega pela loja do Play

- CAP/AC:
  - CAP-dm-backup: AC-dm-37.
  - Interações do protótipo: `backup-export`, `backup-import`.
  - Integração no caminho de produção:
    - AC-dm-01 (instalação limpa pela loja);
    - AC-dm-36 (PDF no webview instalado);
    - AC-dm-44 (rede local);
    - AC-dm-45 (update sem perder dados);
    - AC-dm-46, AC-dm-47, AC-dm-50 (varredura final).
- User-visible outcome:
  - "Exportar meus dados" salva `fitpulse-copia-{data}.json` em Downloads.
  - "Importar uma cópia" acrescenta sem apagar nada. Arquivo inválido ou de versão mais nova é recusado sem mudar nada.
  - O FitPulse instalado pela loja abre, funciona e mantém os dados através de um update.
- Implementation:
  - Schemas e serviço de cópia, rotas e seção nas Configurações.
  - Depois, a integração no caminho de produção, sem nenhuma implementação paralela.
- Create/modify/reuse/retire:
  - CAP-dm-backup: create `server/validation/backupSchemas.ts`; create `server/services/backupService.ts`; create `server/routes/backupRoutes.ts`; create `server/app.ts`; create `src/api/backupApi.ts`; create `src/features/settings/BackupSection.tsx`; create `src/features/settings/SettingsPage.tsx`; create `tests/api/backupRoutes.test.ts`; create `tests/e2e/backup.spec.ts`
- Verification:
  - Testes e smokes: `pnpm test -- tests/api/backupRoutes.test.ts`, `pnpm test:e2e -- tests/e2e/backup.spec.ts`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `node scripts/smoke-migrate.mjs`, `node scripts/smoke-boot.mjs`, `node scripts/smoke-store-package.mjs` e `aioson harness:check . --slug=diagnostico-maturidade`.
  - Smoke manual no Windows:
    1. Publicação privada em modo fonte (`aioson system:publish` sem `--build`, feita pelo dono).
    2. Instalação limpa pela loja abre direto no assistente (AC-dm-01).
    3. Exportar o PDF e a cópia no webview instalado (AC-dm-36, AC-dm-37).
    4. De outro computador da rede, as duas portas recusam conexão (AC-dm-44).
    5. Publicar 0.1.1 e atualizar pela loja: empresas, diagnósticos, rascunhos e preferências continuam (AC-dm-45). O caminho com mudança de esquema fica provado pela simulação do `smoke-store-package.mjs`.
- Done when:
  - O app instalado pela loja no Windows passa pelos passos 1 a 5 do smoke manual.
  - Todas as suítes, os três smokes e `aioson harness:check` saem com código 0.

## Development execution lanes

Escolha do dono em 2026-10-23: duas equipes. Modelos escolhidos pelo dono:
- equipe do servidor: Sonnet 5.5, esforço xhigh;
- equipe das telas: Opus 5.5, esforço high;
- QA: Haiku 5.5, esforço high;
- integrador: Opus 5.5, esforço xhigh.

Host e modelo valem pelo arquivo de papéis (`.aioson/config/execution-roles.json`); ativar e assinar esse arquivo são atos do dono.

| Lane | Exact write paths | Integration owner |
|---|---|---|
| backend | server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore | dev |
| frontend | src/**, index.html, components.json, vite.config.ts | dev |

Fora das duas equipes, sob o integrador (`integration_dev`): `playwright.config.ts`, `tests/e2e/**` e `.aioson/plans/diagnostico-maturidade/harness-contract.json`.

Regras para as equipes:
- A equipe do servidor declara todas as dependências do plano na primeira unidade. A equipe das telas não edita `package.json`; uma dependência faltando vira achado para o integrador.
- Arquivos tocados por mais de uma unidade (`server/app.ts`, `src/App.tsx`, `src/components/layout/AppShell.tsx`, `src/features/result/ResultPage.tsx`, `src/features/companies/CompanyPage.tsx`, `src/features/settings/SettingsPage.tsx`, `src/main.tsx`) ficam em ondas diferentes, na ordem da tabela abaixo.
- Na execução em equipes, as specs e2e e o `harness-contract.json` saem nas linhas de integração. As fases acima continuam valendo como a descrição de cada entrega.

Monitor: `aioson execution:dashboard . --feature=diagnostico-maturidade`

## Interface Contract

Produtor → consumidor em cada linha. Os formatos de erro seguem o IF-010.

| IF | Boundary | Input | Output | Failure | CAP |
|---|---|---|---|---|---|
| IF-001 | `server/routes/playRoutes.ts` → Play, assistente e casca do frontend: `GET /api/health`, `GET /api/aioson-play`, `GET /api/assistant/summary` | nenhum | `{ ok: true }`; `{ name, slug, version, api_base_url, endpoints: [health, assistant/summary], events: [] }`; `{ companies: [{ name, stage, stageName, lockingDimension, lastDiagnosisAt }] }` sem dinheiro e sem respostas | Host estranho → 403 `host_not_allowed`; banco indisponível → 503 `database_unavailable` | CAP-dm-play-runtime |
| IF-002 | `server/routes/companyRoutes.ts` → `src/api/companiesApi.ts`: `GET/POST /api/companies`, `GET/PATCH /api/companies/:id`, `POST :id/archive`, `POST :id/restore`, `DELETE :id` | Lista: `q?`, `stage? 1..4`, `archived?`. Escrita: `{ name 2–80, segment, salesChannel, annualRevenueRange?, cnpj? 14 dígitos }` (mesmo schema para criar e editar) | `Company { id, name, segment, salesChannel, annualRevenueRange?, cnpj?, archivedAt?, latestStage?, latestCompletedAt?, draftId?, completedCount }` ou lista dela | 400 `validation_failed` com `fields`; 404 `company_not_found`; 409 `company_not_archived` ao excluir ativa | CAP-dm-company |
| IF-003 | `server/routes/diagnosisRoutes.ts` → `src/api/diagnosesApi.ts`: `POST /api/companies/:id/diagnoses`, `GET/PATCH/DELETE /api/diagnoses/:id`, `POST /api/diagnoses/:id/complete` | PATCH parcial `{ answers?: { [itemId]: 0..3 \| null }, calculator? (centavos inteiros), currentBlock? 1..8 }` | `Diagnosis { id, companyId, status, answers, calculator, currentBlock, updatedAt, rulesVersion?, result?: DiagnosisResult, previous?: { stage, completedAt } }`; o POST devolve o rascunho existente ou um novo | 400 `validation_failed`; 404 `diagnosis_not_found`; 409 `diagnosis_not_draft` em PATCH/DELETE de concluído; 422 `incomplete` com `pendingBlocks` | CAP-dm-questionnaire, CAP-dm-engine, CAP-dm-unit-economics, CAP-dm-result |
| IF-004 | `shared/**` → frontend, importado como código | Respostas, entrada da calculadora, valores digitados | `questionBank`, `calculatorOptions`, `companyOptions`, `stageContent`, `actionCatalog`, `riskCatalog`, `computeUnitEconomics`, `pendingBlocks`, `formatMoney`/`parseMoney`, `maskCnpj`/`isValidCnpj`, `formatRatio`/`formatPayback`, tipo `DiagnosisResult` | Funções puras: entrada inválida devolve `null` ou "não calculado", nunca lança nem gera NaN/Infinity | CAP-dm-engine, CAP-dm-unit-economics, CAP-dm-questionnaire, CAP-dm-company |
| IF-005 | `server/routes/historyRoutes.ts` → `src/api/historyApi.ts`: `GET /api/companies/:id/timeline`, `POST /api/diagnoses/:id/archive`, `POST /api/diagnoses/:id/restore`, `GET /api/diagnoses/:id/comparison` | ids na rota | `{ draft?, completed[], archived[] }`; diagnóstico atualizado; `{ previous, current, stageChange, dimensions[{ key, before, after, delta }], risksResolved[], risksNew[], recalculated?: { fromVersion, originalScore } }` | 404 `diagnosis_not_found`; 409 `no_previous_diagnosis`; 409 `diagnosis_not_completed` ao arquivar rascunho | CAP-dm-history |
| IF-006 | `server/routes/reportRoutes.ts` → `src/api/reportApi.ts`: `POST /api/diagnoses/:id/report` | id na rota | `{ fileName, directory }` | 409 `diagnosis_not_completed`; 500 `write_failed` sem arquivo gravado | CAP-dm-report |
| IF-007 | `server/routes/homeRoutes.ts` → `src/api/homeApi.ts`: `GET /api/home` | `mode=owner&companyId=` ou `mode=consultant` | Empresa: `{ company, latest?, draft?, trend[] }`; consultoria: `{ byStage[1..4], withoutDiagnosis[], staleDrafts[], overdue[], highRisk[] }`, cada item com `companyId` e `name` | 400 `validation_failed`; 404 `company_not_found` | CAP-dm-home |
| IF-008 | `server/routes/preferenceRoutes.ts` → `src/api/preferencesApi.ts`: `GET/PUT /api/preferences` | PUT `{ usageMode?: owner\|consultant, focusCompanyId?, theme?: dark\|light, tourSeen?: { owner?, consultant? } }` | `{ usageMode: owner\|consultant\|null, focusCompanyId?, theme, tourSeen }` | 400 `validation_failed`; 404 `company_not_found` para empresa em foco inexistente ou arquivada | CAP-dm-settings, CAP-dm-first-run |
| IF-009 | `server/routes/backupRoutes.ts` → `src/api/backupApi.ts`: `POST /api/backup/export`, `POST /api/backup/import` | Exportar: nenhum. Importar: o JSON do arquivo (até 10 MB) | `{ fileName, directory, companies, diagnoses }`; `{ imported: { companies, diagnoses }, skipped }` | 422 `backup_invalid`; 422 `backup_newer_version` com `rulesVersion`; 413 arquivo grande; 500 `write_failed`; em toda falha nada muda | CAP-dm-backup |
| IF-010 | `server/http/requestGuards.ts` e `errorHandler.ts` → `src/api/httpClient.ts` | Escritas com `Content-Type: application/json`; Host `127.0.0.1`/`localhost` | Corpo JSON da rota | `{ error: { code, message, fields? } }`; 403 `host_not_allowed`; 415 `json_required`; 500 `internal_error` | CAP-dm-play-runtime |

## Execution Sequence

| Phase | Wave | Depends on | Files | Scope | Done when |
|---|---|---|---|---|---|
| 1-backend-foundation | 1 | — | package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, .gitignore, manifest.json, prisma.config.ts, prisma/schema.prisma, server/db/databaseUrl.ts | CAP-dm-play-runtime; AC-dm-40 | `pnpm install` sai com 0 sem build ignorado e `pnpm exec prisma validate` passa; `manifest.json` sem `requires_services` nem `auth` |
| 1-backend-db | 2 | 1-backend-foundation (dev) | prisma/migrations/migration_lock.toml, prisma/migrations/20261023000000_init/migration.sql, scripts/prepare-app.mjs, scripts/smoke-migrate.mjs, server/db/prismaClient.ts, tests/helpers/testDatabase.ts | CAP-dm-play-runtime; AC-dm-45 | `node scripts/smoke-migrate.mjs` sai com 0 |
| 1-backend-content | 2 | 1-backend-foundation (dev) | shared/rules/rulesV1.ts, shared/content/stageContent.ts, shared/content/riskCatalog.ts, shared/content/actionCatalog.ts, shared/content/questionBank.ts, shared/content/calculatorOptions.ts, shared/domain/types.ts, tests/unit/questionBank.test.ts, tests/unit/forbiddenTerms.test.ts | CAP-dm-engine, CAP-dm-questionnaire, CAP-dm-result; AC-dm-10, AC-dm-11, AC-dm-29; IF-004 | `pnpm test -- tests/unit/questionBank.test.ts tests/unit/forbiddenTerms.test.ts` passa |
| 1-backend-formats | 2 | 1-backend-foundation (dev) | shared/format/cnpj.ts, shared/format/money.ts, shared/format/displayNumbers.ts, shared/content/companyOptions.ts, tests/unit/cnpj.test.ts, tests/unit/money.test.ts | CAP-dm-company, CAP-dm-unit-economics; AC-dm-08; IF-004 | `pnpm test -- tests/unit/cnpj.test.ts tests/unit/money.test.ts` passa |
| 1-frontend-shell | 2 | 1-backend-foundation (dev) | vite.config.ts, index.html, src/main.tsx, src/App.tsx, src/styles/tokens.css, src/styles/global.css, src/components/layout/AppShell.tsx, components.json, src/lib/utils.ts, src/components/ui/button.tsx | CAP-dm-play-runtime, CAP-dm-company; AC-dm-43, AC-dm-50; IF-001 | `pnpm build` sai com 0 e o `dist/` gerado contém as fontes Inter e JetBrains Mono, sem URL externa |
| 1-backend-rules | 3 | 1-backend-content (dev), 1-backend-formats (dev) | shared/domain/unitEconomics.ts, shared/domain/dimensionScores.ts, shared/domain/stageGate.ts, shared/domain/confidence.ts, shared/domain/riskSignals.ts, shared/domain/completeness.ts, tests/unit/unitEconomics.test.ts, tests/unit/diagnosisRules.test.ts | CAP-dm-unit-economics, CAP-dm-engine, CAP-dm-questionnaire; AC-dm-15, AC-dm-51, AC-dm-19, AC-dm-21, AC-dm-23, AC-dm-24; IF-004 | `pnpm test -- tests/unit/unitEconomics.test.ts tests/unit/diagnosisRules.test.ts` passa |
| 1-backend-http | 3 | 1-backend-db (dev), 1-backend-content (dev) | server/main.ts, server/app.ts, server/http/requestGuards.ts, server/http/errorHandler.ts, server/services/domainError.ts, server/routes/playRoutes.ts, server/services/assistantSummaryService.ts, tests/api/playRoutes.test.ts | CAP-dm-play-runtime; AC-dm-41, AC-dm-42; IF-001, IF-010 | `pnpm test -- tests/api/playRoutes.test.ts` passa |
| 1-backend-package | 3 | 1-backend-db (dev) | system.json, scripts/smoke-boot.mjs, scripts/smoke-store-package.mjs | CAP-dm-play-runtime; AC-dm-44 | `node --check scripts/smoke-boot.mjs`, `node --check scripts/smoke-store-package.mjs` e `aioson system:package . --dry-run` saem com 0, e a lista não tem `data/`, `*.db` nem lockfile |
| 1-frontend-primitives | 3 | 1-frontend-shell (dev), 1-backend-formats (dev) | src/components/ui/alert-dialog.tsx, src/components/ui/input.tsx, src/components/ui/label.tsx, src/components/feedback/ConfirmDialog.tsx, src/components/feedback/StatusView.tsx, src/components/form/TextField.tsx, src/components/form/CnpjField.tsx, src/components/form/MoneyField.tsx, src/api/httpClient.ts | CAP-dm-company, CAP-dm-unit-economics; AC-dm-17, AC-dm-48; IF-004, IF-010 | `pnpm build` sai com 0 |
| 1-backend-evaluate | 4 | 1-backend-rules (dev) | shared/domain/actionPlan.ts, shared/domain/evaluateDiagnosis.ts, tests/fixtures/rulesV2.ts, tests/unit/evaluateDiagnosis.test.ts | CAP-dm-engine; AC-dm-18, AC-dm-20, AC-dm-25, AC-dm-26, AC-dm-49; IF-004 | `pnpm test -- tests/unit/evaluateDiagnosis.test.ts` passa com G1–G4 exatos |
| 1-backend-companies | 4 | 1-backend-http (dev), 1-backend-formats (dev) | server/routes/companyRoutes.ts, server/services/companyService.ts, server/repositories/companyRepository.ts, server/validation/companySchemas.ts, server/app.ts, tests/api/companyRoutes.test.ts | CAP-dm-company; AC-dm-07, AC-dm-09; IF-002 | `pnpm test -- tests/api/companyRoutes.test.ts` passa |
| 1-frontend-companies | 4 | 1-frontend-primitives (dev) | src/api/companiesApi.ts, src/features/companies/CompaniesPage.tsx, src/features/companies/CompanyFormDialog.tsx, src/features/companies/CompanyPage.tsx, src/App.tsx | CAP-dm-company; AC-dm-04, AC-dm-05, AC-dm-06; IF-002 | `pnpm build` sai com 0 e as telas usam só as rotas e campos do IF-002 |
| 1-backend-diagnoses | 5 | 1-backend-evaluate (dev), 1-backend-companies (dev) | server/routes/diagnosisRoutes.ts, server/services/diagnosisService.ts, server/repositories/diagnosisRepository.ts, server/validation/diagnosisSchemas.ts, server/app.ts, tests/api/diagnosisRoutes.test.ts | CAP-dm-questionnaire, CAP-dm-engine; AC-dm-13, AC-dm-16, AC-dm-22; IF-003 | `pnpm test -- tests/api/diagnosisRoutes.test.ts` passa, inclusive o resumo do assistente depois de uma conclusão real |
| 1-frontend-questionnaire | 5 | 1-frontend-companies (dev), 1-backend-rules (dev) | src/api/diagnosesApi.ts, src/features/diagnosis/QuestionnairePage.tsx, src/features/diagnosis/BlockRail.tsx, src/features/diagnosis/AnchoredQuestion.tsx, src/features/diagnosis/useDraftAutosave.ts, src/features/diagnosis/CompletionGate.tsx, src/features/diagnosis/CalculatorBlock.tsx, src/features/diagnosis/UnitEconomicsPanel.tsx, src/App.tsx | CAP-dm-questionnaire, CAP-dm-unit-economics; AC-dm-12, AC-dm-14; IF-003, IF-004 | `pnpm build` sai com 0 e as telas usam só as rotas e campos do IF-003 |
| 1-frontend-result | 6 | 1-frontend-questionnaire (dev) | src/features/result/ResultPage.tsx, src/features/result/StageLadder.tsx, src/features/result/ActionPlanList.tsx, src/features/result/DimensionScores.tsx, src/features/result/RiskList.tsx, src/features/result/NumbersSummary.tsx, src/features/result/ConfidenceNote.tsx, src/App.tsx | CAP-dm-result; AC-dm-28, AC-dm-47; IF-003 | `pnpm build` sai com 0 |
| 2-backend-history | 6 | 1-backend-diagnoses (dev) | shared/domain/compareDiagnoses.ts, server/routes/historyRoutes.ts, server/services/historyService.ts, server/app.ts, tests/unit/compareDiagnoses.test.ts, tests/api/historyRoutes.test.ts | CAP-dm-history; AC-dm-30, AC-dm-31; IF-005 | `pnpm test -- tests/unit/compareDiagnoses.test.ts tests/api/historyRoutes.test.ts` passa |
| 2-backend-report | 7 | 2-backend-history (dev) | server/files/downloadsFolder.ts, server/report/reportModel.ts, server/report/pdfRenderer.ts, server/services/reportService.ts, server/routes/reportRoutes.ts, server/app.ts, tests/unit/reportModel.test.ts, tests/api/reportRoutes.test.ts | CAP-dm-report; AC-dm-36; IF-006 | `pnpm test -- tests/unit/reportModel.test.ts tests/api/reportRoutes.test.ts` passa |
| 2-frontend-history | 7 | 1-frontend-result (dev) | src/api/historyApi.ts, src/features/history/CompanyTimeline.tsx, src/features/history/ComparePage.tsx, src/features/companies/CompanyPage.tsx, src/features/result/ResultPage.tsx, src/App.tsx | CAP-dm-history; AC-dm-30, AC-dm-31; IF-005 | `pnpm build` sai com 0 |
| 2-frontend-report | 8 | 2-frontend-history (dev) | src/api/reportApi.ts, src/features/result/ExportReportDialog.tsx, src/features/result/ResultPage.tsx | CAP-dm-report; AC-dm-36; IF-006 | `pnpm build` sai com 0 |
| 3-backend-preferences | 8 | 2-backend-report (dev) | server/routes/preferenceRoutes.ts, server/services/preferenceService.ts, server/repositories/preferenceRepository.ts, server/validation/preferenceSchemas.ts, server/app.ts, tests/api/preferenceRoutes.test.ts | CAP-dm-settings; AC-dm-38; IF-008 | `pnpm test -- tests/api/preferenceRoutes.test.ts` passa |
| 3-frontend-settings | 8 | 2-frontend-history (dev) | src/api/preferencesApi.ts, src/features/preferences/PreferencesProvider.tsx, src/features/settings/SettingsPage.tsx, src/components/layout/AppShell.tsx, src/main.tsx, src/App.tsx | CAP-dm-settings; AC-dm-39; IF-008 | `pnpm build` sai com 0 |
| 3-backend-home | 9 | 3-backend-preferences (dev) | server/routes/homeRoutes.ts, server/services/homeService.ts, server/app.ts, tests/api/homeRoutes.test.ts | CAP-dm-home; AC-dm-33, AC-dm-34; IF-007 | `pnpm test -- tests/api/homeRoutes.test.ts` passa |
| 3-frontend-home | 9 | 3-frontend-settings (dev) | src/api/homeApi.ts, src/features/home/HomePage.tsx, src/features/home/OwnerHome.tsx, src/features/home/ConsultantHome.tsx, src/features/home/ScoreTrend.tsx, src/App.tsx | CAP-dm-home; AC-dm-32, AC-dm-35; IF-007 | `pnpm build` sai com 0 |
| 4-frontend-backup | 9 | 3-frontend-settings (dev) | src/api/backupApi.ts, src/features/settings/BackupSection.tsx, src/features/settings/SettingsPage.tsx | CAP-dm-backup; AC-dm-37; IF-009 | `pnpm build` sai com 0 |
| 3-frontend-first-run | 10 | 3-frontend-home (dev) | src/features/firstRun/WelcomeModePage.tsx, src/features/firstRun/WelcomeCompanyPage.tsx, src/features/home/OnboardingTour.tsx, src/components/layout/AppShell.tsx, src/App.tsx | CAP-dm-first-run; AC-dm-01, AC-dm-02, AC-dm-03; IF-002, IF-003, IF-008 | `pnpm build` sai com 0 |
| 4-backend-backup | 10 | 3-backend-home (dev), 2-backend-report (dev) | server/validation/backupSchemas.ts, server/services/backupService.ts, server/routes/backupRoutes.ts, server/app.ts, tests/api/backupRoutes.test.ts | CAP-dm-backup; AC-dm-37; IF-009 | `pnpm test -- tests/api/backupRoutes.test.ts` passa |
| 4-integration-e2e-core | 11 | — | playwright.config.ts, tests/e2e/global-setup.ts, tests/e2e/support/fixtures.ts, tests/e2e/shell.spec.ts, tests/e2e/companies.spec.ts, tests/e2e/questionnaire.spec.ts, tests/e2e/calculator.spec.ts, tests/e2e/result.spec.ts | CAP-dm-play-runtime, CAP-dm-company, CAP-dm-questionnaire, CAP-dm-unit-economics, CAP-dm-engine, CAP-dm-result; AC-dm-27, AC-dm-46; as demais ACs das CAPs citadas viajam como contexto e são exercitadas pelas specs desta linha | `pnpm typecheck` + `pnpm test` + `pnpm test:e2e -- tests/e2e/shell.spec.ts tests/e2e/companies.spec.ts tests/e2e/questionnaire.spec.ts tests/e2e/calculator.spec.ts tests/e2e/result.spec.ts` + smoke: concluir um diagnóstico no dev-link do Play em até 3 s |
| 4-integration-e2e-features | 12 | 4-integration-e2e-core | tests/e2e/history.spec.ts, tests/e2e/report.spec.ts, tests/e2e/home.spec.ts, tests/e2e/settings.spec.ts, tests/e2e/accessibility.spec.ts, tests/e2e/firstRun.spec.ts, tests/e2e/backup.spec.ts | CAP-dm-history, CAP-dm-report, CAP-dm-home, CAP-dm-settings, CAP-dm-first-run, CAP-dm-backup; AC-dm-46, AC-dm-47; as demais ACs das CAPs citadas viajam como contexto e são exercitadas pelas specs desta linha | `pnpm test:e2e` completo passa |
| 4-integration-release | 13 | 4-integration-e2e-features | .aioson/plans/diagnostico-maturidade/harness-contract.json | CAP-dm-play-runtime; AC-dm-01, AC-dm-36, AC-dm-44, AC-dm-45, AC-dm-50 | `pnpm build` + `node scripts/smoke-migrate.mjs` + `node scripts/smoke-boot.mjs` + `node scripts/smoke-store-package.mjs` + `aioson harness:check . --slug=diagnostico-maturidade` + smoke: publicação privada e passos 1 a 5 da Fase 4 no Windows |


## Release notes for the owner

A publicação continua sendo um ato do dono e fica fora da execução do @dev. Antes de publicar:
- calibração e validação (OQ-7);
- busca do nome no INPI (OQ-8);
- confirmação do metal bronze antigo (OQ-9).
