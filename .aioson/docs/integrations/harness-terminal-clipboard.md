# Colar imagem nos terminais do harness

Como a imagem do clipboard chega até a CLI que roda no PTY, e por que o contrato
antigo (`^V` e pronto) entregava para umas CLIs e não para outras.

## O caminho

1. A pessoa dá `Ctrl+V` no xterm. `attachTerminalClipboardShortcuts`
   (`src/lib/xterm-copy.ts`) devolve `false` no handler de tecla, então o xterm
   **não** manda `^V` sozinho e o evento `paste` nativo do WebView acontece.
2. Se o `clipboardData` tem imagem, o handler cancela o paste e chama
   `onClipboardImage(images)`.
3. O host do terminal decide como entregar — é aqui que mora a diferença.

## A medição que mudou o contrato (2026-08-09)

Sonda em PTY real (`portable-pty`), fora do Play, com a mesma imagem no
clipboard do Windows (`[System.Windows.Forms.Clipboard]::ContainsImage()` = True,
conferido em outro processo) e o mesmo byte `0x16` escrito no PTY:

| CLI | Resposta ao `^V` |
|---|---|
| `codex` | insere `[Image #1]` no input — **lê o clipboard do SO sozinha** |
| `claude` | só redesenha a TUI; **não anexa nada** |

O que **não** é a causa, cada um descartado com prova:

- **Formato do clipboard.** O `navigator.clipboard.write({"image/png"})` do
  Chromium deixa `PNG, Format17, DeviceIndependentBitmap, Bitmap` no clipboard do
  Windows. O detector do Claude Code (`ContainsImage()`) devolve `True` para isso.
  Só um clipboard com **apenas** o formato `PNG` engana esse detector, e o
  Chromium não produz esse caso.
- **PATH sem `powershell`.** O `claude.exe` detecta imagem com
  `powershell -NoProfile -NonInteractive -Sta -Command "...ContainsImage()..."`,
  e o PTY do harness herda o ambiente do processo do Play — `resolve_harness_env_vars`
  não mexe em `PATH`.
- **Ordem de `term.open()` × attach.** Os três hosts abrem o terminal antes de
  registrar o listener de paste, então `term.element` sempre existe.
- **Sanitização no caminho de escrita.** `maintenance_session_write` manda os
  bytes crus para o PTY, sem filtro.
- **win32-input-mode.** O Claude Code liga `CSI ? 9001 h` no boot; mandar o
  registro de tecla desse protocolo (`ESC [ 86;47;22;1;8;1 _`) também não anexa
  a imagem.

## O contrato atual

`cliReadsClipboardImage(cli)` em `src/services/maintenance.ts` responde se a CLI
lê o clipboard do sistema pelo `^V`.

- **Lê** (`codex`): o host manda `\x16` e a CLI resolve o resto. É o caminho
  antigo, preservado — inclusive o `deliverClipboardImages`, que regrava o
  clipboard entre imagens quando são várias.
- **Não lê** (todas as outras, inclusive `claude`): o host grava a imagem em
  `appLocalDataDir()/clipboard/` com `saveClipboardImage`
  (`src/lib/clipboard-image-file.ts`) e **digita o caminho** no PTY. Caminho em
  disco toda CLI sabe abrir.

O default de `cliReadsClipboardImage` é `false` de propósito: digitar o caminho
funciona em qualquer CLI, então uma CLI ainda não medida cai no caminho que
sempre entrega. Ao medir uma nova, atualizar a função **e** esta tabela.

## Onde está ligado

| Host | Arquivo | Entrega |
|---|---|---|
| Harness de manutenção | `src/pages/MaintenancePage.tsx` (`forwardClipboardImagesToPty`) | ramo por CLI; mantém a trilha de preview |
| Harness de app | `src/components/features/harness/app-develop-surface.tsx` → `harness-terminal.tsx` | ramo por CLI a partir de `state.command` |
| Terminal do painel de artefatos | `src/components/features/maintenance/artifact-panel/terminal-tab.tsx` | segue em `\x16` — é um shell, não uma CLI de agente, e não há CLI para consultar |

`HarnessTerminal` aceita `onClipboardImages`; sem esse prop ele cai no `\x16`,
que é o comportamento antigo.

## Como remedir

Rodar `claude` e `codex` num PTY real, com imagem no clipboard, e comparar a
saída depois de escrever `\x16`. A armadilha da primeira tentativa: um script
que termina com `[System.Windows.Forms.Clipboard]::Clear()` esvazia o clipboard
antes da sonda rodar, e aí **as duas** CLIs parecem quebradas. Confira
`ContainsImage()` num processo separado antes de mandar a tecla. A outra
armadilha: numa pasta ainda não confiada o Claude Code para no prompt de
confiança e nenhuma tecla chega ao input.

Relacionado: `platform-architecture.md`.
