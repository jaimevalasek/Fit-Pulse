# Escolha de banco de dados para apps do Play

> Como decidir entre **SQLite**, **Postgres embedded**, **DB externo local**
> (Laragon/XAMPP/nativo) ou **DB remoto** (VPS/cloud) para um app instalado
> no aioson-play. Tradeoffs, critérios objetivos pra subir de tier, e padrão
> de configuração via `DATABASE_URL`.
>
> Atualizado: 2026-05-21.

---

## TL;DR

1. **Default: SQLite + WAL mode.** Resolve 95% dos casos. Zero ops, zero bundle extra.
2. **App declara `DATABASE_URL` configurável** desde o dia 1. Isso destrava as outras opções sem decidir agora.
3. **Não suba pra Postgres/MySQL por achismo.** Suba quando bater num critério mensurável (seção 4).
4. **O Play NÃO oferece banco compartilhado.** Cada app é dono dos próprios dados
   ([`data-ownership-model`](../../context/bootstrap/data-ownership-model.md)).
   O Play suporta MySQL e PostgreSQL gerenciados **por app**, com bancos operacional e de teste e usuários próprios.
   PostgreSQL usa uma instância local do perfil, com isolamento por banco e papel. Isso não permite compartilhar dados entre apps (Opção E permanece rejeitada).

---

## 1. Por que SQLite é o default (e por que ele aguenta mais do que parece)

O `tauri-plugin-sql` já vem no Play e o ciclo de leitura/escrita não precisa
de processo separado. Com **uma linha de PRAGMA** o ganho de performance é
gigante:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

Com WAL ativo, em SSD comum você tem:

- **~50k–100k inserts/seg** em single-process
- **Leituras paralelas ilimitadas** rodando concorrentemente com 1 escritor
- Travamento real ocorre só quando **2+ processos** escrevem no mesmo arquivo
  simultaneamente — raro no Play (cada app é 1 processo filho)

O mito "SQLite trava com carga" vem de uso sem WAL, ou de cenários
multi-writer entre processos. Nenhum dos dois é o caso default de um app
no Play.

### O que SQLite NÃO faz bem

- **JSONB indexado** (tem `JSON1` mas sem GIN)
- **Full-text com ranking sério** (FTS5 funciona, mas é simples)
- **Vetores/embeddings** (não tem pgvector)
- **Várias instâncias do app escrevendo no mesmo `.db`** ao mesmo tempo
- **Tipagem rigorosa** (SQLite é dinamicamente tipado)

Se o seu app cair num desses, é hora de avaliar tier acima.

---

## 2. Matriz de opções

| Opção | Onde mora | Custo p/ usuário | Custo p/ dev do app | Quando vale |
|---|---|---|---|---|
| **A. SQLite + WAL** (default) | dentro do app, arquivo único | 0 — já vem no Play | 0 — 1 PRAGMA | 95% dos apps. **Comece sempre aqui** |
| **B. Postgres embedded no app** (`postgresql-embedded` crate ou equivalente) | bundle do app | +50–200 MB no instalador, boot +5–15s na 1ª vez (initdb) | médio — gerenciar lifecycle do processo, port, recovery | App com necessidade comprovada de Postgres E que quer ser "self-contained" |
| **C. DB externo local** (Laragon/XAMPP/Postgres nativo, DSN configurável) | máquina do usuário, fora do app | usuário instala e configura uma vez | baixo — só ler `DATABASE_URL` do env | Power-users; apps "pro"; quem já tem infra local |
| **D. DB remoto** (VPS/Supabase/RDS, DSN configurável) | nuvem | depende de conectividade | baixo — só ler `DATABASE_URL` | App que já é online-first ou multi-device; deixa de ser local-first |
| **E. Play oferece DB compartilhado** | Play | médio | baixo | ❌ **Não suportado.** Quebraria `data-ownership-model` e viraria ponto único de falha |
| **F. MySQL gerenciado pelo Play (por app)** | engine em `services/`, dados em `service-data/aioson-mysql/` | 1 clique (download GPL oficial via Play) | zero — `DATABASE_URL` injetada no spawn | App precisa de MySQL ou quer isolamento relacional com credenciais seguras no keyring; provisionado por app em Settings → Apps → Banco |

---

## 3. Padrão recomendado: `DATABASE_URL` configurável

### PostgreSQL gerenciado pelo Play

Settings → Apps & Services → Banco instala o pacote verificado e cria um par de bancos por app.
SQLite continua sendo o padrão. Um app só pode ter um vínculo gerenciado ativo: MySQL ou PostgreSQL.
Credenciais ficam no cofre do sistema; a URL PostgreSQL é entregue exclusivamente ao processo backend.
Nunca usar `VITE_*` ou `NEXT_PUBLIC_*` para a URL. Apps Vite sem backend são recusados.

Apps com processos separados precisam declarar `has_api: true`, `database_process`, `webview_target`
e comandos explícitos por processo no `manifest.json`; veja o guia do desenvolvedor.
Next/Nuxt com backend podem usar o processo único existente. Banco parado, vínculo incompleto ou
contrato ambíguo impedem o start; não há fallback silencioso para SQLite/MySQL.

Remover o vínculo revoga LOGIN e encerra sessões, preservando bancos e dados como `retained`.
Uma nova criação precisa de nomes livres na mesma versão. Remover apenas o pacote preserva também os vínculos;
reinstalar a mesma versão reutiliza o cluster. Não há upgrade de major nem migração de dados entre versões.

### Versões lado a lado (managed-database-versions)

O dono instala qualquer versão do catálogo — **PostgreSQL 14, 15, 16, 17 e 18; MySQL 8.0 e 8.4** —
e várias convivem, cada uma na sua porta fixa (tabela em `port-management.md` § 7.1).

- **O vínculo guarda motor e versão.** Ao criar o banco do app, escolha a versão para a qual o
  esquema e as migrações foram escritos (ex.: hzsoft2 → PostgreSQL 17). A versão não muda depois.
- `DATABASE_URL` (app instalado, sistema e draft), Copiar URL e a Bancada usam sempre a porta da
  versão do vínculo. Versão parada ou removida **impede abrir o app** com o erro
  `postgres_version_stopped:<versão>` / `mysql_version_stopped:<versão>` /
  `mariadb_version_stopped:<versão>` — nunca cai em outra versão, outro motor ou SQLite.
- Nomes de banco e usuário são únicos **dentro de cada versão**: um nome retido no 18 pode ser
  criado de novo no 17. Um app continua com no máximo um vínculo ativo.
- **MariaDB 11.4 (play-managed-mariadb)** usa os mesmos comandos do MySQL (é um sabor da família:
  `flavor: "mariadb"` no vínculo) e a mesma `DATABASE_URL` `mysql://…` — o cliente MySQL padrão do
  app (mysql2, Prisma `mysql`) abre sem mudança. Diferença: **remover o vínculo retém** banco e
  usuários no servidor (o MySQL apaga). Criar de novo com o mesmo nome reabre os dados e troca a
  senha do usuário; nome de banco **e de usuário** de vínculo ativo é único dentro do MariaDB.
- Trocar a versão de um app = remover o vínculo (no PostgreSQL os dados ficam retidos na versão
  antiga), criar outro na versão desejada e transferir os dados por ferramenta externa.
- Uma instância só abre a pasta de dados da própria versão principal; o MySQL marca a pasta com
  `aioson-mysql-major` (a pasta 8.4 de antes é adotada na primeira partida).
- Versões sem suporte oficial (MySQL 8.0; PostgreSQL 14 perto do fim) continuam instaláveis, com
  aviso visível. Só versão com pacote medido e validação nativa no Windows aparece instalável.
Windows x86_64 passou instalação e consultas SQL pelo Play; Linux x86_64 e macOS x86_64/arm64 permanecem bloqueados
no manifesto até validação nativa. A aquisição e o hash medidos não equivalem a validar execução.

**Faça isso desde o dia 1 do app**, mesmo que use SQLite. Custo: ~10 linhas.
Benefício: destrava B/C/D no futuro sem refactor.

### 3.1 Schema do `app-config.yaml`

```yaml
database:
  # Default usado se DATABASE_URL não estiver definida
  default_url: "sqlite://./data/app.db?mode=rwc"

  # Quais drivers seu app suporta — usado pelo Play pra validar override
  supported_drivers: ["sqlite", "postgres"]

  # Settings recomendados pra SQLite (aplicados se driver=sqlite)
  sqlite_pragmas:
    journal_mode: "WAL"
    synchronous: "NORMAL"
    busy_timeout: 5000
```

### 3.2 No código do app

```ts
// Node/TS
const url = process.env.DATABASE_URL ?? config.database.default_url;
const driver = url.startsWith("postgres://") ? "postgres" : "sqlite";
const db = await connect(url, driver);

if (driver === "sqlite") {
  await db.exec("PRAGMA journal_mode=WAL");
  await db.exec("PRAGMA synchronous=NORMAL");
  await db.exec("PRAGMA busy_timeout=5000");
}
```

```rust
// Rust
let url = std::env::var("DATABASE_URL")
    .unwrap_or_else(|_| config.database.default_url.clone());
// sqlx::AnyPool ou enum manual conforme driver
```

### 3.3 No Play (futuro — quando UI de override existir)

`Settings → Apps → <app> → Database` mostra:
- driver atual (lido do default ou do override)
- campo pra apontar `DATABASE_URL` customizada (validada contra `supported_drivers`)
- botão "test connection"

Enquanto a UI não existe, o usuário pode override editando o `.env` do app
ou via env-var injetada pelo `process_manager` (já existe canal pra isso —
ver [`ai-app-integration.md`](./ai-app-integration.md) sobre `VITE_AIOSON_*`).

---

## 4. Critérios objetivos pra subir de tier (não suba por achismo)

**Suba de SQLite pra Postgres apenas se um destes for verdade:**

| Sintoma | Tier sugerido |
|---|---|
| `SQLITE_BUSY` aparecendo em produção mesmo com WAL e `busy_timeout=5000` | C ou B |
| Precisa de `pgvector` (embeddings, busca semântica local) | B ou C |
| Precisa de JSONB com indexação GIN (queries complexas em campos JSON) | B, C ou D |
| Precisa de full-text com ranking sério (não basta FTS5) | B, C ou D |
| 2+ processos do mesmo app escrevendo no mesmo banco simultaneamente | B ou C |
| Já existe Postgres na infra do cliente e quer reusar | C ou D |
| App é multi-device (usuário usa em 2+ máquinas, dados sincronizados) | D |

**Sintomas que NÃO justificam trocar:**
- "Achei que SQLite é lento" — meça com WAL antes
- "Quero paridade com a stack do meu backend cloud" — válido só se for tier C/D, não B
- "Quero usar Prisma/Drizzle com Postgres" — ambos suportam SQLite
- "Recebo muitas requisições" — quantifique. <500 req/s sustentado SQLite resolve

---

## 5. Detalhes de cada opção avançada

### Opção B — Postgres embedded no app

**Crates Rust:** [`postgresql-embedded`](https://crates.io/crates/postgresql-embedded) (mantida) ou `pg-embed` (mais antiga).

**Como funciona:**
1. Na 1ª execução, o app baixa o binário do Postgres (~50–80 MB) pra um diretório local
2. Roda `initdb` (5–15s)
3. Sobe o processo `postgres` em porta dedicada — **use a faixa 3300+** do app, NÃO a faixa 3001–3099 de services
   (ver [`port-management.md`](./port-management.md))
4. App conecta em `postgres://localhost:<porta>/...`

**Custos a observar:**
- Bundle do instalador do app cresce (alguns crates embutem o binário, outros baixam on-demand — escolha "baixar on-demand" pra não inchar)
- Boot do app mais lento na 1ª vez (mostrar splash)
- Antivírus do Windows pode flaggar o `postgres.exe` (assinar binário ajuda)
- Backup vira mais complexo — não é mais "copia 1 arquivo"; precisa `pg_dump`

**Quando faz sentido vs Opção C:**
- B: app quer ser **self-contained** ("instalou, funcionou, não precisa configurar nada")
- C: app é **pro/power-user** ("você cuida do Postgres, eu uso")

### Opção C — DB externo local (Laragon, XAMPP, Postgres nativo)

**Padrão de doc para o app:**

> Pra usar Postgres ao invés de SQLite:
> 1. Instale Postgres localmente — recomendado:
>    - **Windows**: [Postgres EDB installer](https://www.postgresql.org/download/windows/) (só Postgres, ~150 MB)
>    - **Mac**: [Postgres.app](https://postgresapp.com/) (1-click)
>    - **Linux**: `apt install postgresql` / `pacman -S postgresql`
>    - **Stack completa (Apache+PHP+DB)**: Laragon (Win) ou XAMPP (multi-OS) — overkill se você só quer Postgres
> 2. Crie um banco: `createdb meuapp`
> 3. Edite `.env`: `DATABASE_URL=postgres://user:pass@localhost:5432/meuapp`
> 4. Reinicie o app pelo Play

**Tradeoff:** zero código no app (já tem `DATABASE_URL`), mas user-friction
na 1ª config.

### Opção D — DB remoto

Mesmo padrão que C, mas a URL aponta pra cloud. **Atenção**: app deixa de
funcionar offline. Documente isso explicitamente. Se o app precisa funcionar
offline E ter sync online, isso é outra arquitetura (CRDT, replicação) e não
está coberto por este doc.

### Opção F — MySQL gerenciado pelo Play (por app)

Disponível a partir da feature `play-managed-services`.

**Como funciona:**
1. O Play gerencia o ciclo de vida do MySQL 8.4 LTS como um Play Service interno, escutando exclusivamente em `127.0.0.1` na porta dedicada **3040** (ou 4140 em dev profile), sem colidir com portas convencionais do sistema (como a 3306 de um Laragon, Docker ou MariaDB local).
2. Em **Settings → Apps → Banco**, o dono da instalação provisiona um banco para qualquer app instalado.
3. O Play cria automaticamente dois bancos isolados: o **operacional** (`{nome}`) e o de **teste** (`{nome}_test`), cada um com seu próprio usuário (`{usuario}` e `{usuario}_test`) e senhas aleatórias de alta entropia armazenadas no cofre de credenciais do sistema operacional (OS keyring).
4. No boot do app (via Marketplace, draft com vínculo ou sistema no canvas), o Play injeta automaticamente a variável `DATABASE_URL` contendo a connection string do banco operacional:
   `mysql://<usuario>:<senha>@127.0.0.1:3040/<banco>`
5. **Handoff externo:** O operador pode usar o botão "Copiar URL" ou "Abrir no meu cliente" para gerenciar tabelas e dados no DBeaver, TablePlus, MySQL Workbench, etc. O Play não renderiza editor visual de dados embutido.
6. **Retenção e Desinstalação:** A remoção do banco ou a desinstalação do app nunca apaga os arquivos físicos em `service-data/aioson-mysql/`. A UI exige confirmação explícita de exportação ("Já exportei uma cópia dos dados") e confirmação digitada do nome antes de revogar acessos.

**Quando faz sentido:**
- Apps que necessitam de MySQL ou compatibilidade com frameworks SQL complexos (Prisma, TypeORM, Drizzle, etc.).
- Desenvolvedores que querem zero atrito de configuração de infraestrutura no computador do usuário final.
- Mantém o princípio de isolamento: cada app tem seu próprio banco e usuário. Nunca compartilhe bancos entre apps.

---

## 6. Por que o Play não hospeda DB compartilhado (Opção E rejeitada)

Razões pelas quais essa opção foi descartada como produto:

1. **Quebra [`data-ownership-model`](../../context/bootstrap/data-ownership-model.md)** — apps deixam de ser donos dos próprios dados; viram inquilinos dum cluster do Play
2. **Ponto único de falha** — DB do Play cair derruba todos os apps simultaneamente
3. **Modelo de isolamento frágil** — schema/role per-app é frágil; um app mal-comportado pode pesar nos outros
4. **Escolha técnica do app vira escolha técnica do Play** — Play precisaria suportar todas as features que cada app precisar

Se um caso de uso futuro exigir compartilhamento de dados entre apps, o
caminho correto é **Bridge Apps** (ver
[`bridge-architecture`](../../context/bootstrap/bridge-architecture.md)),
NÃO um DB compartilhado.

---

## 7. Checklist pro dev do app

Antes de declarar a feature de persistência pronta:

- [ ] App lê `DATABASE_URL` do env, com fallback pra `default_url` do `app-config.yaml`
- [ ] App declara `supported_drivers` no `app-config.yaml`
- [ ] Se SQLite: PRAGMAs WAL + busy_timeout aplicados no startup
- [ ] App não cria/lista/edita conexões de banco na própria UI — isso vive no Play (Settings)
- [ ] Tem ao menos 1 teste que troca o driver via `DATABASE_URL` (mesmo que CI use SQLite)
- [ ] README do app documenta como apontar pra Postgres externo

---

## 8. Referências cruzadas

- [`ai-app-integration.md`](./ai-app-integration.md) — onde declarar `app-config.yaml`, padrão de env-vars
- [`app-data-bindings.md`](./app-data-bindings.md) — diferente: Global Connectors são pra **dados de domínio** (MCPI/REST), este doc é pro **banco operacional do próprio app**
- [`port-management.md`](./port-management.md) — se for Opção B (Postgres embedded), escolha porta na faixa do app, não na faixa de services
- [`platform-architecture.md`](./platform-architecture.md) — onde a persistência se encaixa no mapa geral
- [`data-ownership-model`](../../context/bootstrap/data-ownership-model.md) — porque o Play não hospeda DB compartilhado
