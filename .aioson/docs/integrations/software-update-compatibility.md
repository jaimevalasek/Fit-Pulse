# AIOSON Play — Atualizacao e Compatibilidade de Apps

> Contrato de integracao para apps publicados no AIOSON Play.
> Todo app instalavel deve declarar com quais versoes do Play, runtime e schema ele e compativel.

## 1. Por que este contrato existe

O AIOSON Play e um runtime desktop: ele executa apps de terceiros via sidecar Node.js, mantem dados locais e pode receber novas versoes do software por update.

Isso cria uma regra central:

**Atualizar o AIOSON Play nao deve atualizar nem quebrar automaticamente os apps instalados pelo usuario.**

O update do Play troca a aplicacao desktop, o frontend, o backend Rust e o sidecar bundled. Ja os apps instalados continuam no diretorio de dados do usuario e precisam ter compatibilidade verificada antes de executar.

## 2. Responsabilidades

| Responsavel | Deve garantir |
|-------------|---------------|
| AIOSON Play | Verificar compatibilidade antes de instalar, atualizar ou executar apps. |
| Desenvolvedor do app | Declarar versoes minimas, schema e dependencias no manifest. |
| Marketplace / aioson.com | Publicar metadados de compatibilidade junto com cada versao do app. |
| Usuario | Escolher quando atualizar o Play e quando atualizar apps instalados. |

## 3. Politica de atualizacao recomendada

### AIOSON Play

Desde a feature `play-auto-update` (2026-10) o Play se atualiza pelo proprio
Play, **sempre com confirmacao do usuario** (o `tauri-plugin-updater`, removido
na v0.1.39, voltou com a chave publica escrita literalmente na configuracao).
Distribuicao detalhada em `play-release-distribution.md`.

- O Play le o `latest.json` do repositorio publico de instaladores
  (`github.com/jaimevalasek/aioson-play-releases/releases/latest/download/latest.json`)
  na abertura e periodicamente (a cada 6 h, nunca menos de 5 min entre consultas).
  Sem internet ou com o GitHub fora do ar, a falha e silenciosa.
- Havendo versao maior, o chip de versao da taskbar fica ambar. O clique abre a
  confirmacao com novidades, o que vai fechar e tres escolhas: "Depois",
  "Ao fechar o Play" e "Atualizar agora".
- **Nada e baixado nem instalado sem uma dessas confirmacoes** (ou fechar o Play
  com a instalacao agendada).
- So e instalado arquivo cuja assinatura confere com a chave publica embutida no
  Play. Assinatura recusada apaga o arquivo e nada e instalado.
- Antes de instalar, o Play roda a mesma limpeza do fechamento normal (sessoes de
  IA, apps, bancos gerenciados, terminais, Play Services, sidecar); o instalador
  NSIS roda em modo passivo (sem botoes) e reabre o Play na versao nova.
- O Play nunca volta de versao sozinho: so e oferecida versao maior que a instalada.
- Build de desenvolvimento (`com.aioson.play.dev`) nunca baixa nem instala.
- Play instalado pelo `.msi` (por maquina, em Arquivos de Programas) nao recebe a
  instalacao automatica: o chip abre `aioson.com/play`, como antes.
- Os dados ficam em AppData, fora da pasta de instalacao, e sao preservados:
  atualizar o Play nao altera apps instalados, projetos, configuracoes nem bancos.
- Plays ate a v0.1.92 (sem atualizador) continuam consultando
  `https://aioson.com/api/play/version` e baixando pelo site; o comando de
  publicacao registra cada versao la tambem.
- Antes de migrations locais, o Play deve criar backup.

### Publicar, retirar e guardar a chave (dono)

- Publicar: `npm run release:publish:win` (detalhes em `scripts/release/README.md`).
- Retirar uma versao com defeito: `npm run release:retract -- <versao>` faz o
  `latest.json` voltar para a anterior; quem ja atualizou recebe a correcao como
  versao de numero maior (nunca volta de versao).
- A chave privada do atualizador fica no gerenciador de senhas do dono com uma
  segunda copia fora do computador; o segredo do GitHub nunca e a unica copia
  (RULE-play-auto-update-04). Perder a chave obriga todos os clientes a reinstalar
  manualmente.
- Versao do Play que depende de mudanca no aioson.com so e publicada depois que o
  site com essa mudanca estiver no ar (RULE-play-auto-update-05). O CHANGELOG
  marca a dependencia com `<!-- requires-site-deploy -->` e o comando exige
  `--site-deployed`.

### Apps instalados

- Apps nao devem ser atualizados junto com o Play automaticamente.
- Cada app deve ter seu proprio fluxo de update via marketplace ou codigo de instalacao.
- O Play deve bloquear, avisar ou degradar com seguranca quando um app instalado nao for compativel com a versao atual do runtime.

## 4. Canais de release

| Canal | Uso |
|-------|-----|
| `stable` | Versao recomendada para usuarios finais. |
| `beta` | Versao para primeiros testers e validacao antes do stable. |

O canal `dev` nao deve ser exposto para usuarios finais na primeira fase publica.

Hoje so existe a trilha stable: o `latest.json` do repositorio publico aponta
para a release marcada como "latest" no GitHub, e `aioson.com/api/play/version`
anuncia a release ACTIVE mais recente para os Plays antigos. O campo `channel`
continua existindo nos settings locais para uma futura trilha beta, mas ainda
nao altera o lookup.

## 5. Regras de versionamento

O AIOSON Play, o runtime/sidecar e os apps devem usar SemVer:

```text
MAJOR.MINOR.PATCH
```

| Mudanca | Exemplo | Impacto esperado |
|---------|---------|------------------|
| `PATCH` | `1.2.0` -> `1.2.1` | Correcoes sem quebrar contrato. |
| `MINOR` | `1.2.0` -> `1.3.0` | Novas capacidades retrocompativeis. |
| `MAJOR` | `1.2.0` -> `2.0.0` | Pode exigir migracao ou novo contrato. |

## 6. Campos obrigatorios no manifest

Todo `manifest.json` de app publicavel deve declarar `compatibility`.

```json
{
  "slug": "meu-app",
  "name": "Meu App",
  "version": "1.0.0",
  "description": "App de exemplo",
  "compatibility": {
    "min_play_version": "0.2.0",
    "min_runtime_version": "1.0.0",
    "max_runtime_version": "1.x",
    "sidecar_contract": "ndjson-v1",
    "schema_version": 1,
    "requires_migration": false
  },
  "packages": [],
  "systems": []
}
```

### Campos

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| `min_play_version` | string SemVer | sim | Menor versao do AIOSON Play que pode instalar/executar o app. |
| `min_runtime_version` | string SemVer | sim | Menor versao do runtime/sidecar necessaria para executar o app. |
| `max_runtime_version` | string range | sim | Maior faixa de runtime considerada segura. Ex: `1.x`. |
| `sidecar_contract` | string | sim | Contrato de comunicacao esperado. Ex: `ndjson-v1`. |
| `schema_version` | integer | sim | Versao do schema dos dados locais do app. |
| `requires_migration` | boolean | sim | Indica se a versao do app exige migracao ao atualizar. |

## 7. Contrato do sidecar

O contrato inicial recomendado e `ndjson-v1`.

Um app compativel com `ndjson-v1` deve:

- aceitar input por argumentos padronizados do sidecar;
- ler `manifest.json`, `app-config.yaml` e `tools.json` no diretorio do app;
- escrever eventos NDJSON no `stdout`;
- escrever erros tecnicos no `stderr`;
- encerrar com exit code `0` em sucesso;
- encerrar com exit code diferente de `0` em falha fatal.

Eventos minimos:

```json
{"type":"chunk","content":"Processando..."}
{"type":"done","duration_ms":1234}
{"type":"error","message":"Falha ao executar app"}
```

## 8. Validacao durante instalacao

Antes de instalar um app, o Play deve validar:

1. `manifest.compatibility` existe.
2. `min_play_version` e atendido pela versao atual do Play.
3. `min_runtime_version` e atendido pela versao atual do runtime/sidecar.
4. `max_runtime_version` inclui a versao atual do runtime/sidecar.
5. `sidecar_contract` e suportado pelo Play.
6. `schema_version` e um inteiro positivo.

Se alguma validacao falhar, o app nao deve ser instalado sem confirmacao explicita e mensagem clara.

## 9. Validacao durante update do Play

Apos atualizar o Play, antes de executar apps instalados, o Play deve reavaliar a compatibilidade de cada app.

Estados recomendados:

| Estado | Quando ocorre | Comportamento |
|--------|---------------|---------------|
| `compatible` | App suporta a versao atual do runtime. | Executa normalmente. |
| `warning` | App nao foi testado na versao atual, mas ainda esta dentro da faixa declarada. | Executa com aviso opcional. |
| `blocked` | App exige runtime mais novo ou nao suporta o runtime atual. | Bloquear execucao e sugerir update do app ou rollback do Play. |
| `migration_required` | App/schema precisa migrar antes de executar. | Fazer backup e pedir confirmacao antes da migracao. |

## 10. Migrations e dados locais

Quando um app tiver dados locais:

- incremente `schema_version` ao mudar estrutura de dados;
- forneca scripts ou passos de migracao versionados;
- nunca apague dados do usuario como estrategia padrao;
- faca backup antes de migrar;
- migrations devem ser idempotentes sempre que possivel;
- falha de migration deve deixar o app em estado bloqueado, nao corrompido.

Exemplo de bloco opcional:

```json
{
  "compatibility": {
    "schema_version": 3,
    "requires_migration": true,
    "migration_from": [1, 2]
  }
}
```

## 10.1 Fluxo de update de app implementado (2026-06-15)

O update de um app de marketplace é **não-destrutivo** — preserva os dados locais
(que não viajam no pacote). Implementado em `marketplace.ts`
(`installMarketplaceApp(storeApp, onState, { update: true })`) + comando Rust
`overlay_path` (`packages.rs`). Botão "Atualizar" no modal de detalhes do app
instalado (Marketplace → Meus Apps), exibido quando `health.updateAvailable`.

Passos:

1. **Parar** o app (+ supervisor) antes de tocar nos arquivos (lock no Windows).
2. **Backup** do app atual (sem `node_modules`) num temp — recuperável se a
   migração falhar (a regra "backup antes de migrar" da seção 10).
3. **Overlay** do pacote novo POR CIMA da pasta existente (`overlay_path`):
   cria/sobrescreve o que vem no pacote e **nunca apaga** — preserva
   `node_modules`, banco SQLite, `.env`, sessão (`auth_info_baileys/`),
   `aioson-models.json` e qualquer dado gitignored.
4. **Migração + deps:** `install_app_deps` roda `pnpm install`, que dispara o
   `postinstall` do app. **É aqui que a migração acontece** — o app coloca seu
   `prisma migrate deploy`/`db push` no postinstall. Falha (`CommandRun.success
   === false`) → mantém o backup e devolve erro (app recuperável, não corrompido).

**O Play NÃO executa um "script de migração" próprio.** Ele detecta/bloqueia
(`requires_migration` → `migration_required` em `ensureAppCanExecute`) mas quem
migra é o app, via `postinstall`. Não há (nem é necessário) um campo
`migrate_command` — o postinstall já é o hook, idêntico ao install.

> ⚠️ `prisma db push --accept-data-loss` é prático mas **arriscado** em mudança
> destrutiva (pode dropar coluna/dado). Para migração versionada segura, o app
> deve usar `prisma migrate deploy` com `prisma/migrations/*.sql` commitados (os
> `.sql` viajam no pacote). O backup do passo 2 é a rede de segurança.

## 11. Politica para breaking changes

Uma mudanca e considerada breaking change quando:

- remove ou renomeia argumento recebido pelo app;
- muda o formato NDJSON esperado;
- muda o local ou formato de `tools.json`;
- muda o formato de `manifest.json` ou `app-config.yaml`;
- altera comportamento de output delivery;
- remove suporte a uma versao de `sidecar_contract`;
- muda schema local sem migration.

Breaking changes devem:

1. aumentar a versao MAJOR do runtime;
2. manter aviso de depreciacao por pelo menos uma versao MINOR, quando possivel;
3. documentar alternativa de migracao;
4. bloquear apps incompativeis em vez de executar com risco.

## 12. Build desktop por plataforma

O AIOSON Play empacota um sidecar por target Tauri. Um release desktop so e
publicavel quando o sidecar do target foi gerado como binario real e validado
antes do `tauri build`.

### Windows

No host Windows, o fluxo canônico e:

```bash
npm run release:build:win
npm run release:validate:win
```

O sidecar esperado e:

```text
src-tauri/binaries/aioson-sidecar-x86_64-pc-windows-msvc.exe
```

### macOS

Build macOS deve rodar em host macOS. Nao gere release macOS por cross-build no
Windows: o `pkg` pode deixar artefatos parciais e o Tauri tambem depende do
toolchain Apple para bundle, assinatura e notarization.

Fluxo em um Mac:

```bash
npm install
cd sidecar && npm install && cd ..
npm run sidecar:build:mac
npm run release:validate:mac
npm run release:build:mac
```

Sidecars esperados:

```text
src-tauri/binaries/aioson-sidecar-x86_64-apple-darwin
src-tauri/binaries/aioson-sidecar-aarch64-apple-darwin
```

Wrappers shell pequenos, placeholders ou arquivos com poucas centenas de bytes
nao sao artefatos de release. Eles dependem de `node` ou `aioson` instalados na
maquina do usuario e devem ser bloqueados por `npm run release:validate:mac`.

Para distribuicao fora de desenvolvimento, o build macOS tambem precisa de:

- Xcode Command Line Tools.
- Certificado Apple Developer ID para assinatura.
- Notarization Apple para instalacao sem alerta de app nao verificado.

## 13. Checklist para publicar um app

Antes de publicar:

- `manifest.json` tem `compatibility`.
- `min_play_version` aponta para uma versao real do Play.
- `min_runtime_version` foi testado.
- `max_runtime_version` nao e amplo demais.
- `sidecar_contract` esta declarado.
- `schema_version` esta declarado.
- O app foi testado com o sidecar bundled, nao apenas com CLI global.
- O app falha de forma clara quando falta tool, config ou credencial.
- Se houver dados locais, existe estrategia de backup/migration.

## 14. Checklist para publicar uma build do Play

Antes de publicar uma build desktop do AIOSON Play:

- Versao esta sincronizada em `package.json`, `package-lock.json`,
  `src-tauri/tauri.conf.json` e `src-tauri/Cargo.toml`.
- `npx tsc --noEmit` passa.
- `npm run i18n:check` passa.
- O sidecar do target passa na validacao:
  - Windows: `npm run release:validate:win`
  - macOS: `npm run release:validate:mac`
- O build foi gerado no host correto para o target.
- Windows: `npm run release:check:win` passou (DLLs de runtime C++ empacotadas).
- A publicacao foi feita por `npm run release:publish:win`: instalador NSIS,
  `.sig` e `latest.json` no repositorio publico e a mesma versao ACTIVE em
  aioson.com (para os Plays antigos e o download com login). Upload manual no
  admin nao e mais o caminho.

## 15. Exemplo de erro para usuario

```text
Este app nao pode ser executado nesta versao do AIOSON Play.

App: farmacia-inteligente
Versao do app: 1.4.0
Runtime necessario: >=1.2.0 <2.0.0
Runtime atual: 2.0.0

Atualize o app pelo marketplace ou instale uma versao compativel do AIOSON Play.
```

## 16. Decisao padrao do AIOSON Play

Para a primeira versao publica:

- update do Play: pelo proprio Play, com confirmacao ("Depois", "Ao fechar o Play",
  "Atualizar agora"), assinatura conferida e instalador NSIS passivo;
- canais: `stable` (beta reservado para o futuro);
- apps: atualizacao separada;
- sidecar: versionado junto com o Play;
- compatibilidade: obrigatoria no manifest;
- migrations: backup antes de alterar dados locais;
- app incompativel: bloquear execucao com mensagem clara.
