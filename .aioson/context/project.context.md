---
project_name: "V-Stage"
project_type: "web_app"
profile: "developer"
framework: "Express + React (Vite) — split-stack"
framework_installed: false
classification: "MEDIUM"
interaction_language: "pt-BR"
conversation_language: "pt-BR"
design_skill: "interface-design"
test_runner: ""
auto_handoff: true
web3_enabled: false
web3_networks: ""
contract_framework: ""
wallet_provider: ""
indexer: ""
rpc_provider: ""
aioson_version: "1.75.0"
generated_at: "2026-10-22T18:05:00.000Z"
---

# Project Context

## Stack
- Backend: Node.js + Express (processo `backend`, porta `BACKEND_PORT`), Prisma ORM
- Frontend: React + Vite (processo `frontend`, porta `PORT`, `webview_target` do Play); `/api` same-origin via proxy do Vite → backend
- Database: SQLite (arquivo local do app, WAL) via Prisma; `DATABASE_URL` configurável com default `file:` dentro da pasta de dados do app — zero provisionamento para quem instala pela loja do Play
- Auth: nenhuma no app (decidido em 2026-10-22) — uso local single-user dentro do Play; sem `aioson-auth`, sem tela de login. Proteção: frontend e backend escutam só em `127.0.0.1`
- UI/UX: Tailwind CSS + shadcn/ui

## Services
- Queues: none
- Storage: none
- WebSockets: none
- Email: none
- Payments: none
- Cache: none
- Search: none

## Web3
- Enabled: no
- Networks: [not applicable]
- Contract framework: [not applicable]
- Wallet provider: [not applicable]
- Indexer: [not applicable]
- RPC provider: [not applicable]

## Installation commands
Gerenciador de pacotes: `pnpm` (lockfile canônico `pnpm-lock.yaml`; não criar `package-lock.json`).

```bash
# raiz — orquestra os dois processos no `pnpm dev`
pnpm init
pnpm add -D concurrently

# frontend
pnpm create vite frontend --template react-ts
cd frontend && pnpm install
pnpm add -D tailwindcss @tailwindcss/vite
pnpm dlx shadcn@latest init

# backend
mkdir backend && cd backend && pnpm init
pnpm add express zod @prisma/client@^7.10.1 @prisma/adapter-better-sqlite3@^7.10.1 dotenv
pnpm add -D prisma@^7.10.1
pnpm exec prisma init --datasource-provider sqlite
```

## Notes
- Por que Vite + backend separado: o Prisma/SQLite e as regras de diagnóstico ficam no backend Node; o frontend Vite só fala com `/api`. Contrato split-stack: `.aioson/docs/play/manifest-and-runtime.md` ("Split-stack apps").
- Banco: SQLite escolhido em 2026-10-22 porque o app vai para a loja do Play e o dono da PME instala sozinho; Postgres/MySQL gerenciados exigem provisionamento manual em Settings → Banco (e o Postgres só é validado no Windows x86_64). Fonte: `.aioson/docs/integrations/app-database-choice.md` §1 e §3.
- Layout alvo: `frontend/` (Vite) + `backend/` (Express + Prisma) + `package.json` raiz com `dev` via `concurrently`; scripts de subpacote rodam `pnpm run dev` dentro do próprio diretório (nunca binário pelado do PATH do Play).
- `manifest.json` ainda é o stub do install: a primeira entrega de @dev deve atualizá-lo para o contrato split-stack (`stack: "split"`, `processes` com `port_env` e comandos, `webview_target: "frontend"`, `has_api: true`, `compatibility.schema_version`). Sem `requires_services` e sem bloco `auth`.
- `has_api: true` exige `GET /api/aioson-play` listando apenas rotas reais.
- Instalação e update pela loja: o Play roda `pnpm install`, que dispara o `postinstall` do app; é ali que roda `prisma migrate deploy` (cria o banco na instalação e migra no update). Usar só migrations versionadas em `prisma/migrations/*.sql`; nunca `prisma db push --accept-data-loss`. Fonte: `.aioson/docs/integrations/software-update-compatibility.md` §10–10.1.
- O update do Play sobrepõe o pacote novo sem apagar arquivos, mas **sobrescreve o que vier no pacote**: o arquivo `.db` nunca pode ser publicado (gitignored, fora de `src/`). Ao mudar o schema, incrementar `compatibility.schema_version` no manifest.
- SQLite: aplicar `PRAGMA journal_mode=WAL` e `busy_timeout=5000` no startup.
- Prisma: **fixar `^7.10.1`** (prisma, @prisma/client e adapter) — em 2026-10-22 `prisma@latest` aponta para `8.0.0-rc.25`. Prisma 7 exige driver adapter (`@prisma/adapter-better-sqlite3`), `prisma.config.ts` com a URL, projeto ESM, Node ≥ 20.19 e `dotenv` explícito. O adapter usa `better-sqlite3 ^12.6` (binário pré-compilado; sem prebuild, compila e exige Visual Studio + Python no Windows) — testar a instalação limpa pela loja no Windows e no macOS com o Node do Play. Fonte: `researchs/ferramentas-diagnostico-mercado/summary.md` §5.
- Sem auth no app: por isso os servidores (Vite e Express) fazem bind em `127.0.0.1`, nunca `0.0.0.0` (o webview do Play carrega `http://127.0.0.1:<porta>` — `.aioson/docs/integrations/port-management.md`). Os dados (faturamento, mídia, CAC/LTV) ficam inacessíveis pela rede local. Motivo da decisão: cada dono de PME ou consultor usa o próprio Play com os próprios dados; `aioson-auth` exigiria serviço instalado + login + cadastro de operador. Reavaliar só se surgir uso multi-operador na mesma instalação.
- Linguagem (TypeScript vs JavaScript) e test runner ainda não confirmados; os comandos acima assumem TypeScript no frontend — @planner confirma.

## Conventions
- Language: pt-BR
- Code comments language: pt-BR
- Source code identifiers: English (paths, filenames, classes, functions, variables — product copy stays in the project language)
- DB naming: snake_case
- JS/TS naming: camelCase
