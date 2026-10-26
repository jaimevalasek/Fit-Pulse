<!-- AIOSON:BEGIN -->
> AIOSON-managed: `aioson update` replaces this block. Keep project rules outside it.

# AIOSON

You operate as AIOSON. Route by agent.

## Mandatory first action

1. Read `.aioson/context/project.context.md` before acting; validity comes from `aioson context:validate . --json`, not from eyeballing the contract. If missing or still invalid after an objectively inferable repair, run `/setup` from `.aioson/agents/setup.md`.
2. Read `.aioson/config.md` only for setup, unresolved routing policy, or an active agent request.
3. If `.aioson/rules/` has Markdown rules, note this silently. Concrete agents use `context:brief` (`must_load` is binding, `related` is recall) and `context:select` as fallback.

## Project knowledge

Read `.aioson/learnings/INDEX.md` if it exists. Each line is a project gotcha or recipe with its file path and a one-line summary. Lazy-load individual files only when title/scope matches your current task or files being touched.

Bare context names resolve under `.aioson/context/`; never probe other roots.

## Routing kernel

- An activated `/agent` executes `.aioson/agents/{agent}.md`. Do not display it.
- Without an active agent, load `.aioson/docs/gateway/agent-routing.md`; apply its Concrete implementation lane gate and activate that lane.
- Load `.aioson/docs/gateway/workflow-runtime.md` only for feature lifecycle, handoff, Autopilot, external-client tracking, or stale workflow repair.
- If the user has not supplied a concrete task, use the starting lanes in `agent-routing.md` and stop for selection.

## Memory loading

Default **ON**. Opt out via `AIOSON_OPERATOR_MEMORY=false`. Run `aioson op:list --json --titles-only`; skip `anonymous-fallback` identity with its warning. Bodies via `aioson op:show <slug>`. No CLI: read `MEMORY.md` under `~/.aioson/operators/{sha256(git-email)[0..16]}/`. Project rules win conflicts.

## Memory capture

Capture authorization, exclusion, correction, and repeated confirmation best-effort with `aioson op:capture --signal=<type> --quote="<verbatim>" --proposal="<paraphrase>" --source-agent=<self>`. Never retry or block; confirmations promote on second detection. Anything noticed outside the current scope is never fixed in passing nor dropped: `aioson observe . --kind=<defect|idea|process|risk|question> --summary="<one line>"`.

## Workflow kernel

`workflow:next` owns routing only after the current request is confirmed as continuation of its active feature; pass `--expect-feature=<slug>`. For an unbound request, run the Concrete lane and workflow-relevance gates first. Preserve unrelated workflow state; Simple Plan goes directly to DEV. Otherwise: Product → Sheldon → Planner → DEV → QA. Raw-source prework is Briefing → Refiner → approval; visual scope needs an approved owned prototype.

Autopilot applies when the current activation explicitly includes `--auto`, persisted `auto_handoff`, seeded policy, or v2 `orchestration.mode: autopilot`. An explicit `--step` disables Autopilot for that activation. It pauses for decisions; auto-closes only after final QA under an explicitly authorized `.aioson/closure-policy.json`; `--step` suppresses close. Closure never authorizes publish.

## Process skill: review-intelligence

For a concrete feature artifact, load its `SKILL.md`, then exactly one matching reference. If unavailable, run the same review manually for at most two passes. See `process-and-research.md` for triggers.

## Process skills: feature expansion

Briefing/Product/Sheldon expand only for rich surfaces, prior evidence, or explicit request. Taxonomy: `.aioson/docs/feature-expansion-taxonomy.md`.

## Process and research

Load `.aioson/docs/gateway/process-and-research.md` only for SDD gates, process-skill selection, skill reachability/usage, or web-research persistence. Do not globally load `spec*.md`.

`CLAUDE.local.md` may hold local overrides.

## Golden rule

Small project, small solution.
<!-- AIOSON:END -->
<!-- AIOSON-PLAY-CONTRACT:START (gerado pelo AIOSON Play — não edite entre os marcadores) -->
## AIOSON Play integration

Este app é destinado a rodar **dentro do AIOSON Play** (desktop Tauri 2). O Play é
um runtime local que **spawna este app como processo filho**, aloca porta, injeta
variáveis de ambiente e embeda a UI num webview. **Este app NÃO é um servidor web
standalone** — ele é gerenciado pelo Play.

### Regras invioláveis (qualquer mudança que toque runtime, ports, auth ou manifest)

1. **NUNCA hardcode porta.** Sempre `process.env.PORT || <fallback>`. Em split-stack,
   também `process.env.BACKEND_PORT`. O Play aloca a porta no spawn.
2. **Tela de login: desenhe a sua, mas dirija pelo `@aioson/auth-sdk`.** O app com
   auth PRECISA de uma tela de login (email+senha) + gate "sem sessão → login". Mas
   NUNCA reinvente o protocolo: use `createAuthClient({ baseUrl:
   VITE_AIOSON_AUTH_URL, bindingId: VITE_AIOSON_AUTH_BINDING_ID, storage:
   localStorageAdapter() })` + `<AuthProvider>`/`useAuth().login()` — nunca
   `fetch('/api/auth/*')` na mão nem um storage de token paralelo. Receita completa
   (gate + formulário + sessão persistida) em `.aioson/docs/integrations/ai-app-integration.md`
   §6. NÃO crie tela de "configurar Auth URL/Binding ID" — o Play injeta as duas no
   spawn; se você vê essa tela, as env não chegaram (atualize o Play).
3. **NUNCA chame `https://aioson.com` direto do browser.** Faça proxy pelo seu backend.
4. **NUNCA invente env var.** Lista canônica injetada pelo Play no spawn:
   - `PORT` — porta do processo (frontend, em split-stack)
   - `BACKEND_PORT` — porta do backend (split-stack)
   - `AIOSON_APP_SLUG` / `VITE_AIOSON_APP_SLUG` — slug deste app (= `manifest.json` slug)
   - `AIOSON_APP_DIR` — path absoluto do diretório do app
   - `VITE_AIOSON_PLAY_URL` — sempre `http://localhost:5180` (ProductBridge do Play)
   - `VITE_AIOSON_AUTH_URL` — URL do Play Service `aioson-auth` (se rodando)
   - `VITE_AIOSON_AUTH_BINDING_ID` — UUID do binding do app no aioson-auth (se vinculado)
   - `AIOSON_COM_TOKEN` — token cloud (se o dono logou no aioson.com)
5. **`manifest.json` é a fonte de verdade** da estrutura do app. Se mudar
   runtime/ports/processes/requires_services, atualize o `manifest.json` primeiro.
   Se usa `aioson-auth`, declare também `auth.permissions[]` e `auth.policies[]`
   no manifest; o painel Auth aplica essas permissões aos perfis globais.
6. **`app-config.yaml` `data_bindings`** declaram slots de dados externos. O admin do
   Play os vincula a Global Connectors. Em runtime: `POST http://localhost:5180/api/mcp/execute`
   com o `alias` do slot.
7. **Se tem API HTTP, exponha `GET /api/aioson-play`** retornando o schema de
   capabilities. Sem isso, o Bridge App e o LLM orquestrador não enxergam suas rotas.
   Liste apenas endpoints que **existem** de verdade.

### Contrato de erro e SSO

- Backends de app validam Bearer pelo SDK server-safe (`verifyRemoteBearer`) e
  preservam `status`, `error.code` e `requestId`; falha de rede do Auth é `503`
  / `auth_unavailable`, não um `401` genérico.
- O Play pode injetar tokens SSO internos em processos autenticados. Eles **não**
  fazem parte do contrato público de frontend: o padrão continua sendo login pelo
  SDK. Use `initialSession` somente após revisão específica da exposição do app.

### Preview rodando (dev) — como saber a URL/porta

Quando o usuário inicia o preview no Play, o servidor de dev sobe numa porta
alocada pelo Play. O Play escreve o estado em **`.aioson/preview.json`** na raiz
deste app:

```json
{ "running": true, "url": "http://localhost:3501", "port": 3501, "startedAt": "..." }
```

Quando o preview está parado: `{ "running": false }` (ou o arquivo não existe).

Se você (IA) precisar saber se o app está servindo e em qual URL — pra testar um
endpoint, abrir o preview, ou confirmar que subiu — **leia esse arquivo sob
demanda**. Ele é atualizado pelo Play em runtime; você não precisa (e não deve)
parar o que está fazendo nem pedir pro usuário.

### Arquivos obrigatórios

- `manifest.json` no root — mínimo: `{ "slug", "name", "version", "runtime": "node", "has_api" }`.
  Split-stack adiciona `"stack": "split"` + `"processes": { ... }` + `"webview_target"`.
  Apps com RBAC declaram `"requires_services": ["aioson-auth"]` e `"auth": { "version": 1, "permissions": [...] }`.
- `app-config.yaml` — se o app consome dados externos (declara `data_bindings`).
- `package.json` — Play roda `npm run dev` (dev-link) ou `npm start` (marketplace).
  Split-stack: `dev` orquestra ambos os processos (ex.: `concurrently`).

### Checklist "pronto pra Play" (gate antes de declarar pronto)

- [ ] `manifest.json` no root com `slug`, `version`, `runtime`, `has_api` corretos
- [ ] Split-stack: `processes` declara todas as portas via `port_env`
- [ ] Todo acesso a porta lê `process.env.PORT` / `process.env.BACKEND_PORT` (nunca hardcode)
- [ ] Dados externos: `app-config.yaml` declara `data_bindings`
- [ ] `has_api: true` → implementou `GET /api/aioson-play` com schema válido
- [ ] Auth de operador → declarou `auth.permissions[]` no manifest e usou `@aioson/auth-sdk`, não `fetch('/api/auth/*')` direto
- [ ] Testou em dev-link (Settings → Instalar App → Linkar pasta) — webview renderiza, badge verde

> Documentação canônica completa já foi copiada neste projeto em
> `.aioson/docs/integrations/` e `.aioson/docs/play/` — consulte esses arquivos
> (ex.: `ai-app-integration.md`, `port-management.md`, `local-tts-integration.md`)
> em vez de tentar deduzir o contrato do código.
<!-- AIOSON-PLAY-CONTRACT:END -->
