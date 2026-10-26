# AIOSON Play — Gerenciamento de Portas

> Como apps e Play Services recebem e mantêm suas portas — e como se descobrem.
> Atualizado: 2026-08-24 (perfil dev: portas fixas deslocadas para o Play instalado e o `npm run tauri dev` rodarem ao mesmo tempo — § 1.1)
> Anterior: 2026-05-04 (PR1 do redesign port-supervisor: allocator unificado + persistência split-stack + registry completo)

---

## 1 — Faixas de porta reservadas

| Faixa | Uso | Atribuição |
|-------|-----|-----------|
| `3001–3099` | Play Services (ex: `aioson-auth` na 3091, `aioson-mysql` na 3040) | **Fixa** — declarada em `service.json` |
| `3040–3059` | Bancos gerenciados pelo Play, **uma porta por versão** (§ 7.1) | **Fixa e reservada** — nenhum outro serviço usa esta faixa |
| `3100–3299` | Sistemas internos do Play | Reservada — não usar |
| `3300+` | Apps instalados via marketplace | **Dinâmica** — atribuída na instalação |
| `4000–4099` | Apps externos curados | **Dinâmica** — novos apps começam em `4010` para evitar portas comuns (`4000–4003`) |
| `4101–4199` | Play Services no build de **dev** | Espelho deslocado de `3001–3099` — vide § 1.1 |
| `5173` | Dashboard de sistemas em dev | Dev server Vite |
| `5180` | ProductBridge (Rust HTTP server) | Fixo — núcleo do Play instalado |
| `5181–5281` | Servidor de sync interno | Dinâmica — `sync_http_server.rs` varre a faixa |
| `5182` | ProductBridge no build de **dev** | Vide § 1.1 |

**Regra:** nunca codifique uma porta de outro app como constante. Use o port registry.

### 1.1 — Perfil dev: as portas fixas se deslocam

O Play instalado e o `npm run tauri dev` foram feitos para rodar **ao mesmo
tempo**. O identificador do Tauri já separa disco, bancos e perfil do WebView2
(`com.aioson.play` × `com.aioson.play.dev`), mas porta TCP é recurso do SO e não
deriva do identificador — sem deslocamento, a segunda instância a subir perde o
bind e o serviço nem inicia.

`src-tauri/src/dev_profile.rs` é a fonte única dessa regra, toda ela sob
`cfg!(debug_assertions)` — **o binário publicado não passa por nenhum desvio**:

| | Play instalado (release) | Play dev (debug) |
|---|---|---|
| ProductBridge | `5180` | `5182` (5181 é do sync) |
| Play Service que declara `3040` (`aioson-mysql`) | `3040` | `4140` |
| PostgreSQL gerenciado (`aioson-postgresql`) | `3041` | `4141` |
| Redis gerenciado, cache e filas (`aioson-redis`, § 7.1) | `3047` e `3048` | `4147` e `4148` |
| Demais versões de banco gerenciado (§ 7.1) | `3042–3059` | `4142–4159` |
| Play Service que declara `3091` (`aioson-auth`) | `3091` | `4191` |
| Faixa fixa inteira | `3001–3099` | `4101–4199` (offset `+1100`) |

O `service.json` **continua canônico**: o Auth embutido declara `3091` nas duas
instâncias e quem desloca é o runtime. Assim o mesmo pacote baixado da loja
serve os dois perfis sem reescrita em disco.

Consequência para quem consome: **a porta real sempre sai do runtime**, nunca do
manifesto. `local_auth_service_url` lê do gerenciador de serviços, o frontend usa
`getServicePort(slug)`, e os apps recebem `AIOSON_PLAY_URL` com a porta do bridge
da instância que os spawnou. Um literal `5180` ou `3091` em código novo faz um
app do dev conversar com o Play instalado.

Espelhos fora do Rust que precisam acompanhar `dev_profile.rs` se a regra mudar:
`src/services/local-tts.ts` (`import.meta.env.MODE`), `scripts/smoke-tauri-boot.mjs`
e `scripts/smoke-bundled-auth.mjs` (ambos sobem o binário de debug).

**Apps externos:** o range reservado permanece `4000–4099` por compatibilidade
com installs existentes, mas o cursor inicial do `PoolKind::External` é `4010`.
No start, se a porta persistida estiver ocupada por outro processo, o Play
realoca para a próxima livre, atualiza `external_app_installs.port` e sincroniza
`app_runtime_ports`.

---

## 2 — Como apps recebem sua porta

### 2.1 Play Services (porta fixa)

Declaram a porta em `service.json`:

```json
{ "slug": "aioson-auth", "port": 3091, ... }
```

O `service_manager.rs` (Rust) lê esse valor e inicia o processo com `PORT=…` via
env var. A porta não muda entre execuções — é a identidade do serviço.

Único desvio: no build de dev a porta declarada passa por
`dev_profile::service_port()` antes do spawn, então o processo nasce em `4191` e
recebe `PORT=4191` (§ 1.1). O `service.json` não é reescrito. Quem precisa da
porta pergunta ao runtime (`get_service_port`), nunca ao manifesto.

### 2.2 Apps (porta dinâmica)

**Instalação:**
1. `install-app.ts` chama `allocate_app_port(appSlug)` → Rust aloca a próxima porta livre ≥ 3300
2. A porta é gravada no `manifest.json` do app como `api_base_url`:
   ```json
   { "has_api": true, "api_base_url": "http://localhost:3301" }
   ```
3. O `manifest.json` é **a fonte de verdade persistente** da porta do app

**Boot (a cada reinicialização do Play):**
1. `AppPage.tsx` chama `spawnAppApi(appDir, slug)` → Rust (`spawn_app`)
2. `spawn_app` lê `api_base_url` do `manifest.json` e extrai a porta
3. O app é iniciado na **mesma porta de sempre** — não há drift entre reinicializações
4. Só aloca porta nova se `api_base_url` estiver ausente (app recém-instalado sem porta ainda)

---

## 3 — Anti-colisão

O `PortAllocator` em `port_allocator.rs` é o único ponto de alocação. Os 2
managers de processo (`app_process_manager` pra marketplace, `draft_process`
pra drafts/dev-link) delegam ao allocator compartilhado via Tauri State.

Garantias:

1. **Faixas isoladas por pool:**
   - `PoolKind::Marketplace` → `[3300..=3499]`
   - `PoolKind::Draft` → `[3500..=3999]`
   - Marketplace cheio NÃO invade Draft — retorna `AllocError::PoolExhausted`
2. **Porta livre:** antes de retornar, verifica com `TcpListener::bind` que a porta não está em uso por nenhum outro processo do sistema operacional
3. **Sem repeat:** o cursor por pool avança — portas já alocadas na sessão não são reutilizadas
4. **Pressão sinalizada:** após inspecionar 100 portas sem sucesso, log warn no stderr (`[port_allocator] {pool}: ... pressão na faixa`)
5. **Reuso de porta persistida:** `try_reserve(pool, port)` valida range + bind-check antes de aceitar — usado pra reusar portas gravadas em manifest.api_base_url (marketplace) ou na tabela `app_runtime_ports` (draft/dev-link)

---

## 4 — Port Discovery: `GET $AIOSON_PLAY_URL/api/registry`

Apps que precisam chamar outros apps ou services consultam o ProductBridge:

```
GET http://localhost:5180/api/registry
```

**Use a env var `AIOSON_PLAY_URL`, não o literal.** O Play injeta nela o bridge
da instância que spawnou o app — `5180` vindo do Play instalado, `5182` vindo do
Play em modo dev (§ 1.1). Um literal `5180` num app aberto pelo dev consulta o
registry do Play instalado e descobre as portas do perfil errado.

Resposta:

```json
{
  "aioson-auth": {
    "port": 3091,
    "url": "http://localhost:3091",
    "kind": "play_service"
  },
  "notas": {
    "port": 3301,
    "url": "http://localhost:3301",
    "kind": "app"
  },
  "atendimento": {
    "port": 3501,
    "url": "http://localhost:3501",
    "kind": "draft_app"
  }
}
```

**Tipos (`kind`):**
- `app` → app marketplace instalado (faixa 3300-3499)
- `draft_app` → app rodando via dev-link/draft (faixa 3500-3999); split-stack expõe a porta do `webview_target`
- `play_service` → Play Service com porta fixa (faixa 3001-3099)

**Por que isso importa:** se um app precisar descobrir outro app dinamicamente (não apenas o `aioson-auth`), esse endpoint é o ponto único de verdade. Não é necessário para services — use `AIOSON_{SERVICE}_URL` env var.

### Exemplo TypeScript (em um app)

```typescript
const PLAY_URL = import.meta.env.VITE_AIOSON_PLAY_URL || 'http://localhost:5180';

async function getPortRegistry(): Promise<Record<string, { port: number; url: string; kind: string }>> {
  const res = await fetch(`${PLAY_URL}/api/registry`);
  if (!res.ok) return {};
  return res.json();
}

async function getServiceUrl(slug: string): Promise<string | null> {
  const registry = await getPortRegistry();
  return registry[slug]?.url ?? null;
}
```

---

## 5 — Como apps consomem Play Services (padrão preferido)

O aioson-play injeta env vars automaticamente quando spawna um app, com base nos services rodando:

```
VITE_AIOSON_AUTH_URL=http://localhost:3091
```

Convenção de nome: `VITE_AIOSON_{SLUG_UPPER}_URL`
- `aioson-auth` → `VITE_AIOSON_AUTH_URL`
- `aioson-email` → `VITE_AIOSON_EMAIL_URL`

**Use a env var** (injetada no boot) em vez do registry para Play Services — é mais simples e já vem disponível. O registry é para descoberta dinâmica de apps entre si.

```typescript
// Em um app consumindo aioson-auth: valor injetado pelo Play.
const authUrl = import.meta.env.VITE_AIOSON_AUTH_URL;
if (!authUrl) throw new Error('AIOSON Auth was not injected by Play');
```

---

## 6 — Declarar dependências de serviço

No `manifest.json` do app, declare quais Play Services são necessários:

```json
{
  "slug": "meu-app",
  "has_api": true,
  "api_base_url": "http://localhost:3301",
  "requires_services": ["aioson-auth"]
}
```

O aioson-play usa `requires_services` para:
1. Verificar no `AppOnboarding` se os serviços estão instalados antes de liberar o app
2. Injetar as env vars `VITE_AIOSON_{SERVICE}_URL` ao spawnar o app

---

## 7 — Portas reservadas (registro)

| Porta | Espelho dev | Slug | Tipo |
|-------|-------------|------|------|
| `3040–3059` | `4140–4159` | bancos gerenciados por versão (§ 7.1) | Play Service |
| `3091` | `4191` | `aioson-auth` | Play Service |
| `5180` | `5182` | ProductBridge | Núcleo Play |
| `5173` | — | Dev dashboard | Sistemas em dev |

> **Ao publicar um novo Play Service:** registre a porta aqui para evitar colisões com outros serviços futuros. Escolha uma porta no range `3001–3099`. A coluna "Espelho dev" é derivada (`+1100`, § 1.1), não declarada — nada a fazer além de anotar.

---

### 7.1 — Bancos gerenciados: uma porta fixa por versão (managed-database-versions)

O PostgreSQL, o MySQL e o MariaDB gerenciados rodam **lado a lado, uma instância por versão principal**,
cada uma com pasta de dados, senha de administrador e registro próprios. A porta é da versão
e é igual em toda máquina (RULE-mdv-02):

| Porta | Espelho dev | Versão | Slug da pasta (`services/`, `service-data/`) |
|-------|-------------|--------|----------------------------------------------|
| `3040` | `4140` | MySQL 8.4 (padrão) | `aioson-mysql` |
| `3041` | `4141` | PostgreSQL 18 (padrão) | `aioson-postgresql` |
| `3042` | `4142` | PostgreSQL 17 | `aioson-postgresql-17` |
| `3043` | `4143` | PostgreSQL 16 | `aioson-postgresql-16` |
| `3044` | `4144` | PostgreSQL 15 | `aioson-postgresql-15` |
| `3045` | `4145` | PostgreSQL 14 | `aioson-postgresql-14` |
| `3046` | `4146` | MySQL 8.0 | `aioson-mysql-80` |
| `3047` | `4147` | Redis 8 — servidor de cache | `aioson-redis` (dados em `service-data/aioson-redis/cache`) |
| `3048` | `4148` | Redis 8 — servidor de filas | `aioson-redis` (dados em `service-data/aioson-redis/queue`) |
| `3049` | `4149` | MariaDB 11.4 (sabor da família MySQL, não padrão) | `aioson-mariadb-114` (conta de cofre `root:11.4`) |
| `3050–3059` | `4150–4159` | livres para versões futuras | — |

- Versão nova recebe a **próxima porta livre** da faixa; uma porta **nunca** é reaproveitada
  por outra versão. A fonte é o manifesto de cada motor (`src-tauri/resources/managed-postgres.json`,
  `managed-mysql.json`, que também traz o MariaDB com `"flavor": "mariadb"`), conferido por `managed_database_catalog_ports_are_fixed_per_version`.
- A versão padrão de cada motor mantém slug, pastas e contas de cofre de antes das versões
  (instalações existentes não mudam de porta nem de pasta).
- Porta ocupada por outro processo deixa **só aquela versão** em conflito; o Play não troca de
  porta, não adota e não encerra o processo alheio.
- Exceção: o servidor **do próprio Play** que sobrou de uma sessão anterior (Play fechado à
  força — o Windows não leva os filhos junto) não é conflito. Quem escuta na porta rodando o
  executável exato da pasta do pacote da instância (`services/<slug>/bin/postgres.exe` ou
  `mysqld.exe`) é desligado antes da partida e da troca de pacote — PostgreSQL com
  `pg_ctl stop -m fast` na própria pasta de dados, MySQL como o Parar faz — e o Play liga de
  novo com o processo dele (`process_util::own_server_roots`). Sem isso, a tela mostrava
  "porta ocupada" com o banco rodando e o reparo do MySQL falhava com "arquivo em uso (os error 32)".
- **Redis gerenciado** (play-managed-redis): um pacote (`services/aioson-redis/`, marcado por
  `aioson-redis.json`, **sem** `service.json` — não passa pelo gerenciador de Play Services) e
  dois servidores, cada um com porta fixa própria: cache em `3047` e filas em `3048`. Cada um
  sobe de dentro da sua pasta de dados (`service-data/aioson-redis/{cache,queue}`) com
  `redis.conf` e `users.acl` reescritos a cada partida; o porte MSYS2 do redis-windows lê
  `C:/...` como caminho relativo, então o arquivo só usa caminhos relativos. Porta ocupada por
  outro programa deixa só aquele servidor em `port_in_use`, com o nome do programa; o
  `redis-server.exe` do próprio pacote que sobrou de outra sessão recebe `SHUTDOWN` e, se não
  sair, é encerrado (`managed_redis_runtime::release_leftover`).

## 8 — Apps split-stack (backend + frontend separados)

Apps **fullstack único** (Next.js, Nuxt, Remix) servem UI e API na mesma porta — basta ler `process.env.PORT`. Sem complicação.

Apps **split-stack** rodam dois processos:
- **Frontend** (Vite/CRA/etc) — vai para a webview do aioson-play
- **Backend** (Express/Fastify/etc) — API consumida pelo frontend

Para apps split, o aioson-play aloca **uma porta por processo** declarado e injeta a env var de cada uma no spawn. Não há porta fixa em scripts do app — tudo é dinâmico, evitando colisão entre apps split simultâneos.

### Schema do manifest

O app declara seu stack e os processos:

```json
{
  "slug": "meu-app",
  "runtime": "node",
  "has_api": true,
  "stack": "split",
  "processes": {
    "frontend": { "port_env": "PORT",         "framework": "vite" },
    "backend":  { "port_env": "BACKEND_PORT", "framework": "node" }
  },
  "webview_target": "frontend"
}
```

| Campo | Significado |
|---|---|
| `stack: "split"` | Sinaliza ao runtime que precisa de alocação multi-porta |
| `processes.<name>.port_env` | Nome da env var que vai carregar a porta alocada |
| `processes.<name>.framework` | Informativo (vite/node/express/...) — não afeta runtime |
| `webview_target` | Qual processo recebe a webview (deve casar com uma key de `processes`) |

Apps fullstack omitem `stack`/`processes` e seguem o caminho clássico: aioson-play aloca uma porta única e injeta apenas `PORT`.

### Como o spawn funciona

O `npm run dev` do app é o ponto de entrada único (umbrella). Dentro dele, `concurrently` (ou similar) sobe os processos. O aioson-play injeta **todas** as env vars de porta de uma vez — ambos os filhos herdam.

```
aioson-play (Rust)
    ↓ spawn pnpm/npm run dev (ou comando do classify_for_spawn)
    ↓ env: PORT=<frontend>, BACKEND_PORT=<backend>, AIOSON_APP_*, ...
npm run dev
    ↓ concurrently
    ├─ npm run dev:server   → ts-node-dev usa BACKEND_PORT
    └─ npm run dev:dashboard → vite usa PORT
```

A webview embeda `http://127.0.0.1:<webview_target_port>` — no exemplo acima, a porta do frontend.

### Convenção mínima para apps split

**`package.json` do app:**

```json
{
  "scripts": {
    "dev": "concurrently --names backend,dashboard --prefix-colors blue,magenta \"npm:dev:server\" \"npm:dev:dashboard\"",
    "dev:server":    "ts-node-dev --respawn --transpile-only src/server.ts",
    "dev:dashboard": "cd dashboard && vite"
  },
  "devDependencies": {
    "concurrently": "^9",
    "ts-node-dev": "^2"
  }
}
```

> Nada de `cross-env BACKEND_PORT=...` hardcoded — deixe o aioson-play injetar. Em standalone (fora do aioson-play), o app cai nos defaults via fallback no código.

**`server.ts` (backend):**

```ts
// PORT é reservada pelo Vite frontend — nunca caímos nela.
const PORT = process.env.BACKEND_PORT || 3301;
httpServer.listen(PORT);
```

**`vite.config.ts` (frontend):**

```ts
const port = Number(process.env.PORT) || 5173;
const backendPort = Number(process.env.BACKEND_PORT) || 3301;
const backendTarget = `http://localhost:${backendPort}`;

export default defineConfig({
  server: {
    port,
    host: true,
    strictPort: true,
    proxy: {
      '/api':       { target: backendTarget, changeOrigin: true },
      '/socket.io': { target: backendTarget, ws: true },
    },
  },
});
```

**Cliente (React) — `App.tsx`:**

```ts
import { io } from 'socket.io-client';
const socket = io();  // same-origin — passa pelo proxy do Vite até o backend
```

### Anti-colisão garantida

- O `PortAllocator` (compartilhado entre os 2 managers) usa `TcpListener::bind` antes de cada return — porta em uso é pulada.
- Para split, são **N chamadas consecutivas** ao mesmo allocator — cada processo ganha sua própria porta livre, sem chance de empate entre processos do mesmo app ou apps simultâneos.
- O cursor por pool avança naturalmente, então portas alocadas não são reusadas dentro da mesma sessão.
- Quando o pool fica cheio, retorna `AllocError::PoolExhausted` em vez de invadir a faixa do outro pool.

### Persistência entre boots

Portas alocadas a apps split-stack/dev-link são gravadas em `app_runtime_ports`
(SQLite, em `aioson-play-int.db`):

| Coluna | Valor |
|---|---|
| `app_slug` | identifica o app |
| `process_name` | "default" (fullstack) ou nome do `manifest.processes` (split-stack: ex.: "frontend", "backend") |
| `kind` | "marketplace" ou "draft" |
| `port` | porta alocada |
| `last_used_at` | ISO 8601 |

No próximo `spawn_app_runtime`, o aioson-play tenta `try_reserve` cada porta
gravada. Se a porta ainda está livre → reusa. Se ocupada (por qualquer
processo do SO) → cai em `allocate` fresh + atualiza o registro. Resultado:
URLs de iframe e logs antigos continuam válidos entre reinicializações
estáveis.

Marketplace continua usando `manifest.api_base_url` como fonte primária —
mesmo critério de `try_reserve` antes de reusar.

### Limitações conhecidas

1. **`api_base_url` legacy:** apps que ainda têm `api_base_url` no manifest (caminho antigo de marketplace install via `app_process_manager.rs`) seguem o single-port path mesmo se declararem `processes`. Isso vale só para apps publicados em produção pré-multi-porta — limpar quando o caminho for unificado.
2. **Browser deve ficar same-origin:** em apps split-stack, o browser deve chamar `/api` e `/socket.io` pelo frontend. Mesmo quando `VITE_BACKEND_PORT` existe, não use `http://127.0.0.1:<backend_port>` no código browser-facing; WebKit/Tauri pode recusar conexão direta enquanto `curl` no WSL funciona. O Vite proxy é o contrato oficial.
3. **Healthcheck por processo:** o aioson-play registra as portas declaradas em `manifest.processes` e faz probe periódico via `probe_app_processes` (bind-test). Ainda assim, o app deve expor `/api/health` ou endpoint leve equivalente para loading states e debug humano.
4. **Sem auto-respawn (PR2):** quando um processo morre, o `AppRuntimeView` marca como `error` mas não reinicia automaticamente — usuário precisa clicar restart. Supervisor com auto-respawn vem no PR2 do redesign de port-supervisor (ver `.aioson/context/architecture-port-supervisor.md`).

Para o contrato completo de compatibilidade de apps instaláveis, veja `.aioson/docs/app-runtime-integration-contract.md`.
