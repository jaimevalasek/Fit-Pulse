# Data Bindings — Apps consumindo Global Connectors

> Como apps declaram suas **fontes de dados** e como o aioson-play orquestra
> a vinculação a Global Connectors (MCPI/REST/etc) configurados pelo usuário.

---

## Princípio

**Aioson-play = registry global** de infraestrutura (LLM, DB connections, Data
Connectors). **Cada app = configuração contextual** que consome esses
registries via HTTP em `localhost:5180`.

Apps NÃO devem expor UI para criar Database Connection ou Data Connector —
isso vive no aioson-play (Settings). Apps DEVEM expor UI para **vincular**
seus slots de dados a connectors já criados.

---

## 1 — App declara o que precisa (`app-config.yaml`)

```yaml
data_bindings:
  - id: "busca-produtos"
    description: "Busca produtos no catálogo da farmácia por nome ou princípio ativo"
    accepted_types: ["mcpi", "api", "mcp"]
    required_params:
      - "search"

  - id: "webhook-pedido"
    description: "Notifica sistema externo quando um pedido é confirmado"
    accepted_types: ["api"]
    required_params:
      - "pedido_json"
```

Campos:
- `id` — slug do slot (kebab-case). Usado como `alias` no binding.
- `description` — texto pt-BR mostrado na UI do app
- `accepted_types` — **forma canônica** (array): tipos de connector que o slot aceita,
  dentre `mcpi` (query SQL via Data Connector), `api` (REST) e `mcp` (stdio). Bate com
  `ai-app-integration.md`, contra o qual os apps são gerados.
- `expected_type` — forma legada (string única). Ainda aceita pelo Play por
  compatibilidade (normalizado em `src/services/data-bindings.ts`), mas prefira
  `accepted_types` em apps novos.
- `required_params` — lista de placeholders aceitos pelo connector

---

## 2 — Aioson-play cria os Global Connectors (admin/usuário)

`Settings → Database Connections` — cadastra credenciais do banco do cliente.
Para drivers testáveis, a conexão precisa passar no **Testar conexão** antes
de ser usada em um Global Connector MCPI. O Play persiste o status
`validated`/`failed`/`untested` junto aos metadados da conexão.

`Settings → Data Connectors` — cria um GlobalConnector apontando para a
connection acima, com query template. O modal tem **"Testar antes de salvar"**
(desde 2026-07-02): roda o mesmo executor que os apps usam (`connector_exec`)
com valores de exemplo pros `{{params}}` — MCPI executa a query no banco de
destino, API dispara o request, MCP sobe o servidor e lista as tools. Nada é
persistido no teste.

Somente DbConnections validadas devem ser selecionáveis para connectors MCPI.
Se o banco estiver pendente/falho, volte em `Settings → Database Connections`,
corrija host/porta/credenciais e rode o teste novamente.

### Auth do connector `api` (campo "Headers / Auth JSON")

- **Formato**: objeto JSON não vazio com valores string, ex.
  `{"Authorization": "Bearer abc123"}`. O valor é **literal** — não existe
  interpolação de `{{param}}` em headers (só na URL). Validado no save e no
  teste (`normalize_auth_json` em `global_connectors.rs`, espelho em
  `validateAuthJson` no frontend); JSON inválido é rejeitado em vez de ser
  gravado e descartado em silêncio na execução.
- **Onde vive**: cofre do SO, chave `gc-auth-{id}`, serviço
  `connector_exec::KEYRING_SERVICE` (`aioson-play`, ou `aioson-play-dev` em
  build de debug — o MESMO que a execução lê). Nunca vai pro SQLite nem pro
  `GET /api/connectors` do bridge.
- **Write-only**: o token nunca volta pra tela. Na edição o modal consulta
  `has_connector_auth(id)` (bool) e mostra "credencial salva"; campo vazio
  **mantém** a salva, preenchido **substitui**, "Remover credencial" manda
  `clear_auth: true`. Trocar o tipo pra algo que não é `api` apaga a chave.
- **URL com segredo**: `?token=...` na URL fica em texto claro no SQLite e é
  listado pros apps locais — o modal avisa; use o campo de headers.

```sql
-- busca-produtos (type=mcpi)
SELECT id, nome, principio_ativo, preco, estoque
FROM produtos
WHERE nome ILIKE '%{{search}}%'
LIMIT 20
```

---

## 3 — App vincula slot a connector (UI in-app)

Cada app expõe sua aba "Fontes de Dados" que consome:

| Método | Path | Uso |
|---|---|---|
| `GET` | `/api/connectors?type=mcpi` | Lista connectors compatíveis com cada slot |
| `GET` | `/api/bindings/:app_slug` | Lista vínculos ativos |
| `POST` | `/api/bindings/:app_slug` | Cria/substitui vínculo — body `{connector_id, alias}` |
| `DELETE` | `/api/bindings/:app_slug/:connector_id` | Remove vínculo |

CORS habilitado (`Access-Control-Allow-Origin: *`) + preflight OPTIONS
respondido com 204. Apps em qualquer porta podem chamar.

### Exemplo TS (frontend do app):

```ts
const PLAY_BASE = "http://localhost:5180";
const APP_SLUG = "atendimento";

// Listar slots compatíveis
const cs = await fetch(`${PLAY_BASE}/api/connectors?type=mcpi`).then(r => r.json());

// Listar vínculos atuais
const bs = await fetch(`${PLAY_BASE}/api/bindings/${APP_SLUG}`).then(r => r.json());

// Vincular busca-produtos ao connector "drug-catalog"
await fetch(`${PLAY_BASE}/api/bindings/${APP_SLUG}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    connector_id: "<uuid-do-connector>",
    alias: "busca-produtos",
  }),
});
```

Implementação real de referência: `atendimento/dashboard/src/DataSourcesView.tsx`.

---

## 4 — App executa o connector via alias (runtime)

Após o bind, o app chama o connector via alias — o MESMO endpoint executa os
três tipos (`mcpi`, `api`, `mcp`), roteando pelo tipo do connector
(implementação: `src-tauri/src/connector_exec.rs`, desde 2026-07-02):

```bash
POST http://localhost:5180/api/mcp/execute
Content-Type: application/json

{
  "alias": "busca-produtos",
  "params": {
    "search": "dipirona"
  },
  "tool": "nome-da-tool"   // opcional — só para connectors MCP com várias tools
}
```

Resposta (mesmo formato pros três tipos):

```json
{
  "data": [
    { "id": "1", "nome": "Dorflex 30com", "principio_ativo": "Dipirona", "preco": 14.90, "estoque": 25 }
  ],
  "error": null,
  "duration_ms": 12
}
```

`alias` deve corresponder ao `data_bindings[].id` declarado e ao binding
ativo (o lookup em runtime é pelo **slug do connector**).

### O que cada tipo faz na execução

| Tipo | Execução |
|---|---|
| `mcpi` | Query no **banco de destino** da Database Connection (senha vem do keyring), `{{param}}` vira prepared statement (nunca concatenação). Drivers: postgresql, mysql, sqlite. |
| `api` | HTTP na URL do connector: `{{param}}` interpolado na URL (percent-encoded); params não usados na URL viram query string (GET/DELETE) ou body JSON (POST/PUT); headers de auth do keyring aplicados. Resposta JSON vira `data`; não-JSON vira string. |
| `mcp` | Servidor MCP **local via stdio**: o Play spawna o comando do connector, faz o handshake JSON-RPC (`initialize` → `tools/list` → `tools/call`) e devolve o resultado da tool. Se o servidor expõe UMA tool, ela é usada; com várias, passe `tool` no request (ou `params._tool`). Timeout 60s, processo morto ao final de cada chamada. |

### MCP: escopo atual e o que ainda NÃO existe

- **Suportado hoje**: servidores MCP locais por **stdio** (ex.:
  `npx -y @modelcontextprotocol/server-sqlite C:\dados\loja.db`). A
  autenticação desses servidores é por env/argumento do próprio comando —
  não há OAuth envolvido.
- **NÃO suportado ainda**: servidores MCP **remotos** (transporte HTTP), que
  pelo spec usam **OAuth 2.1** para autorização. Isso exige fluxo de browser,
  armazenamento/refresh de token e registro dinâmico de cliente — fase futura
  planejada; não simule com headers manuais.
- O spawn é por chamada (sem sessão persistente). Servidores com boot caro
  ficam lentos por chamada — aceitável na v1; sessão persistente é evolução
  possível.

---

## 5 — Estado degradado (sem binding)

Se um slot está declarado mas sem binding ativo, o app deve operar em
**modo degradado** (mock data, alerta no UI, etc). Padrão recomendado: emitir
banner no UI linkando direto para a aba "Fontes de Dados".

Para apps que dependem de connectors específicos para funcionar:
1. Declare `data_bindings` no `app-config.yaml`
2. No boot, consulte `GET /api/bindings/:app_slug` para detectar slots não-vinculados
3. Mostre alerta ou bloqueio com link para a UI de vinculação interna

Exemplo: o atendimento usa `HarnessCapabilityDetector + DegradedModeReporter`
(em `src/services/harness/`) para detectar `tools.json` ausente e emitir
`kanban:degraded_mode` via Socket.io. Quando o user clica no banner, a UI
navega para a aba "Fontes de Dados" do dashboard.

---

## 6 — Visão admin consolidada (Settings global)

`Settings → App Data Sources` no aioson-play continua existindo como **visão
admin** — lista todos os apps que têm `data_bindings` declarados, com bindings
agrupados. Útil para auditoria, mas o caminho principal do usuário é a
**aba in-app** de cada app.

Como a tela descobre os apps (desde 2026-09-27):

- Varre `apps/` em paralelo e lê `app-config.yaml` via `loadAppConfig`
  (plugin-fs com fallback pro comando Rust `read_app_config`, porque app
  **dev-link** é symlink pra fora do scope do plugin-fs — antes esse app
  simplesmente não aparecia).
- Três resultados por app: sem config (ignorado), config presente mas
  ilegível/YAML inválido (aparece no bloco "Apps com problema no
  app-config.yaml" com o erro), com `data_bindings` (card).
- Botão **Atualizar** refaz a varredura e mostra "N apps verificados · M com
  fontes de dados · última verificação"; a tela também recarrega sozinha no
  evento `aioson:apps-installed-changed`.
- Vínculo cujo connector foi apagado em Data Connectors aparece como
  "vínculo quebrado" com botão pra remover — ele não esconde mais um vínculo
  válido feito depois pro mesmo slot.

---

## 7 — Endpoints relacionados

| Método | Path | Uso |
|---|---|---|
| `GET` | `/api/registry` | Port discovery (apps + services rodando) |
| `POST` | `/api/mcp/execute` | Executa connector (mcpi/api/mcp) por alias |
| `GET` | `/api/connectors[?type=...]` | Lista global connectors |
| `GET` | `/api/bindings/:app_slug` | Lista bindings do app |
| `POST` | `/api/bindings/:app_slug` | Bind connector (body: connector_id + alias) |
| `DELETE` | `/api/bindings/:app_slug/:connector_id` | Unbind |

Doc complementar:
- `port-management.md` — como portas são alocadas
- `dev-link-install.md` — como apps em dev rodam dentro do Play
- `aioson-app-developer-guide.md` — guia geral de desenvolvimento de apps
