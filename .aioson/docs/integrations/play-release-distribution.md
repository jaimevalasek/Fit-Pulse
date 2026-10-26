# AIOSON Play — Distribuição de versões pelo GitHub

> Contrato da feature `play-auto-update` (CAP-play-auto-update-publish e
> CAP-play-auto-update-site). Comportamento do Play diante de uma versão nova:
> `software-update-compatibility.md` §3.

## 1. Onde mora cada coisa

| Peça | Onde | Quem lê |
|---|---|---|
| Código do Play | `jaimevalasek/aioson-play` (privado) | — |
| Instaladores, `.sig` e `latest.json` | `jaimevalasek/aioson-play-releases` (público, só releases) | Play com atualizador; site |
| Testes de publicação | `jaimevalasek/aioson-play-releases-test` (público) | Build de teste |
| Release anunciada aos Plays antigos | aioson.com, admin → Play Releases (`PlayRelease` + `PlayReleaseAsset.externalUrl`) | Play até v0.1.92 (`GET /api/play/version`) |
| Download com login | `aioson.com/play` → `GET /api/download/play?platform=windows` | Visitante |

O repositório público precisa ter ao menos um commit (um README basta): o GitHub
cria a tag da versão a partir do branch padrão quando a release é publicada.

## 2. `latest.json`

Endereço fixo embutido no Play (`plugins.updater.endpoints` em
`src-tauri/tauri.conf.json`):

```text
https://github.com/jaimevalasek/aioson-play-releases/releases/latest/download/latest.json
```

O GitHub resolve `releases/latest` para a release marcada como "latest". Formato
(uma entrada por sistema e arquitetura; só Windows nesta entrega):

```json
{
  "version": "0.1.93",
  "notes": "### Added\n- ...",
  "pub_date": "2026-10-21T12:00:00.000Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<conteúdo do .sig em base64>",
      "url": "https://github.com/jaimevalasek/aioson-play-releases/releases/download/v0.1.93/AIOSON.Play_0.1.93_x64-setup.exe"
    }
  }
}
```

- `notes` vem da seção `## [vX.Y.Z]` do `CHANGELOG.md`; é o texto da confirmação no Play.
- `url` aponta para a tag, nunca para `latest`: a assinatura vale para aquele arquivo.
- O GitHub troca espaço por ponto no nome do arquivo (`AIOSON Play_…` → `AIOSON.Play_…`).

## 3. Publicar

`npm run release:publish:win` (`scripts/release/publish-play-release.mjs`):

1. Recusa antes de qualquer envio: chave pública vazia ou de exemplo, endpoint
   diferente do repositório público, chave privada ou tokens ausentes, CHANGELOG
   sem a seção da versão, versão marcada `<!-- requires-site-deploy -->` sem
   `--site-deployed`, tag já publicada.
2. Build: `release:prepare:win` → `tauri build` → `release:verify:win` (o mesmo
   que `release:build:win`).
3. Confere: instalador NSIS e `.sig` da versão existem, nenhum `.msi` da versão foi
   gerado, e a assinatura confere com a chave pública embutida.
4. GitHub: cria a release **como rascunho**, sobe instalador, `.sig` e
   `latest.json` (nessa ordem) e só então publica com `make_latest`. Falha no meio
   apaga o rascunho; rascunho órfão de execução interrompida é apagado na próxima.
5. Site: cria a release do software `play`, registra o artefato externo
   (`POST /api/admin/play-releases/external-asset`) e ativa. Falha aqui não desfaz
   o GitHub: o comando avisa e `npm run release:publish:win -- --site-only` repete
   só o site (idempotente).

Variáveis (ambiente ou `.env.signing.local`): `TAURI_SIGNING_PRIVATE_KEY`,
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `AIOSON_RELEASES_GITHUB_TOKEN`,
`AIOSON_SITE_API_TOKEN` e, opcional, `AIOSON_SITE_URL` (padrão `https://aioson.com`).

### Pela nuvem (etapa 2)

A tag `v{versão}` no repositório privado dispara `.github/workflows/release-play.yml`
(Windows do GitHub): checkout do Play e da CLI `jaimevalasek/aioson` na tag de
`scripts/release/aioson-cli-ref.txt`, a cadeia de `release:prepare:win` (sem a
conferência do ZIP local do Auth, que só existe no PC do dono; a do pacote
publicado continua), `tauri build`, `release:verify:win` e
`publish-play-release.mjs publish --ci --skip-build`. Em `--ci` os segredos vêm só
do ambiente e a tag tem de ser a versão do `tauri.conf.json`. A declaração do Auth
embarcado vem da variável `BUNDLED_AUTH_MANIFEST` do repositório.

## 4. Retirar

`npm run release:retract -- <versão>`:

- marca a versão como pré-release (sai do "latest") e devolve "latest" à maior
  versão anterior publicada; o `latest.json` volta a anunciá-la;
- arquiva a release no site, e `/api/play/version` volta a anunciar a anterior;
- o arquivo retirado continua no GitHub (quem tem o link ainda baixa);
- quem já atualizou não volta de versão: a correção sai como versão de número maior.

## 5. Site (aioson-com)

- `PlayReleaseAsset.filePath` é anulável e `externalUrl` guarda o endereço do
  GitHub (migração `20261021000000_play_release_external_asset`).
- Artefato externo só é aceito com URL `https`, sem credencial, dentro da lista
  permitida e com o nome igual ao último trecho do endereço. Lista padrão:
  `https://github.com/jaimevalasek/aioson-play-releases/releases/download/`. No
  site local, `PLAY_RELEASE_EXTERNAL_URL_PREFIXES` (separado por vírgula) troca a
  lista — por exemplo para o repositório de teste.
- `GET /api/download/play`: login, política de plano e limite de um download por
  hora valem antes; depois, artefato externo vira redirecionamento `302` para o
  GitHub (o endereço é conferido de novo contra a lista).
- `GET /api/play/version` não mudou de contrato: anuncia a release ACTIVE ativada
  por último.

## 6. Repositório de teste

`npm run release:publish:win -- --repo jaimevalasek/aioson-play-releases-test
--site-url http://localhost:3000` gera um Play que procura versões no repositório de
teste (o build recebe o endpoint por `tauri build --config`) e registra no site
local. Nunca publique um build de teste no repositório público.

## 7. Transição dos Plays antigos

- Play até a v0.1.92 não tem atualizador: o chip continua âmbar e abre
  `aioson.com/play`; depois do login o download redireciona ao GitHub.
- A primeira versão com atualizador é instalada à mão uma última vez. A nota dela
  no CHANGELOG deve dizer, em palavras simples:
  - que é a última reinstalação manual: as próximas versões chegam pelo chip;
  - que quem instalou pelo `.msi` deve desinstalar a cópia antiga (Configurações do
    Windows → Aplicativos) antes de instalar esta, para não ficar com duas cópias.
- Play instalado pelo `.msi` (por máquina, em Arquivos de Programas) não recebe a
  instalação automática: o chip abre a página do site.
