# Browser walkthrough — prototype-relatorios-e-acompanhamento

- Verdict: **PASS** (107/107 steps executed ok)
- Target: file:///C:/dev/playapps/v-stage/.aioson/briefings/relatorios-e-acompanhamento/prototype.html (file, scope prototype)
- Browser: Playwright Chromium (bundled) 151.0.7922.34
- Script: .aioson/briefings/relatorios-e-acompanhamento/walkthrough.json (sha256 4b450cc72a1b)
- Replay: `aioson browser:run . --script=.aioson/briefings/relatorios-e-acompanhamento/walkthrough.json --file=.aioson/briefings/relatorios-e-acompanhamento/prototype.html --slug=relatorios-e-acompanhamento --prototype`

## Ids proven

| Id | Status | Steps | Error |
|---|---|---|---|
| PROM-002 | PASS | 1, 6, 7, 8, 106 |  |
| PROM-001 | PASS | 2, 5, 12, 13, 14, 15, 16, 17, 19, 24, 26 |  |
| PROM-004 | PASS | 5, 6, 7, 8, 9, 10, 11, 16, 17, 20, 21, 22, 29, 80, 81, 82 |  |
| PROM-008 | PASS | 33, 35, 37, 38, 40, 41 |  |
| PROM-005 | PASS | 43, 44, 45, 46, 47, 48, 49, 52, 54, 56, 57, 77 |  |
| PROM-003 | PASS | 43, 45, 59, 77, 78 |  |
| PROM-006 | PASS | 59, 60, 65, 67, 68, 69, 70, 71, 73, 75, 78 |  |
| PROM-007 | PASS | 84, 85, 86, 87, 89, 94, 95, 96, 98, 100, 102, 103, 105 |  |

## Production-path smoke (derived)

- Entry: file:///C:/dev/playapps/v-stage/.aioson/briefings/relatorios-e-acompanhamento/prototype.html
- Trigger: click role=button[name="Pular"]
- Real boundary: (no boundary step proven)
- State change: css=.dialog [role="alert"] is visible; css=[data-aioson-id="export-saved"] is visible; css=[data-aioson-id="reports-empty"] is visible; css=#b-email[aria-invalid="true"] is visible; text of css=#e-logo (1): "Use uma imagem PNG ou JPG. Arquivos SVG não são aceitos."; text of css=.cover-preview .cover-brand (1): "Rumo Consultoria(11) 98877-6655 · marina@rumoconsultoria.com.br · rumoconsultoria.com.br"; text of css=.pages .paper >> nth=0 (1): "Rumo Consultoria(11) 98877-6655 · marina@rumoconsultoria.com.br · rumoconsultoria.com.brRelatório de evoluçãoPadaria Tri…"; text of css=.pages .paper >> nth=1 (1): "Antes e depois
        1 → 2Subiu um degrau: Descoberta para Ajuste— → R$ 82Custo por cliente32 → 53Média das 8 dimensõe…"; "Continua do diagnóstico de 20/04/2026" found 1×; "Vencida em 15/10/2026" found 1×; text of css=[data-aioson-id="reeval-line"] (1): "Refazer em 25/11/2026 · faltam 32 dias"; css=[data-aioson-id="closed-actions"] is visible; text of css=.toasts (1): "Marca salva. Os próximos PDFs saem com ela."Testar um anúncio com orçamento pequeno" agora está em andamento.Desfazer"; text of css=#e-due (1): "Data inválida. Use DD/MM/AAAA, por exemplo 15/11/2026."; text of css=[data-aioson-id="action-d2-teste"] (1): "03
    Testar um anúncio com orçamento pequenoUm teste curto mostra se o canal traz cliente pelo custo que você aguenta.…"; text of css=[data-aioson-id="action-d2-teste"] (1): "03
    Testar um anúncio com orçamento pequenoUm teste curto mostra se o canal traz cliente pelo custo que você aguenta.…"; "Custo por cliente medido" found 1×; text of css=#e-month (1): "Setembro de 2026 já está anotado. Edite o mês na lista."; css=[data-aioson-id="month-2026-10"] is visible; text of css=[data-aioson-id="month-2026-10"] (1): "out/2026
    R$ 1.200,00gasto em 1 parte
    30clientes novos
    R$ 40,00por cliente
    EditarExcluir"; role=dialog[name=/Excluir outubro de 2026/] is visible; css=[data-aioson-id="month-2026-10"] is not visible; css=[data-aioson-id="diary-empty"] is visible; "Refazer o diagnóstico" found 1×; css=[data-aioson-id="home-diary-widget"] is visible; "Sua carteira" found 1×; css=.paper[aria-label*="Empresas por estágio"] is visible; text of css=.dialog (1): "Enviar questionário para Padaria Trigo BomO FitPulse gera um arquivo que abre no navegador do computador do cliente, sem…"; text of css=.dialog (1): "Arquivo geradoSalvo na pasta Downloadsquestionario-padaria-trigo-bom.htmlMande o arquivo com a mensagem que você copiou.…"; css=[data-aioson-id="desktop-note"] is visible; "Revise e salve" found 1×; css=[data-aioson-id="client-saved"] is visible; text of css=.dialog [role="alert"] (1): "Não foi possível importarEste arquivo é de Ateliê Linha Fina, não de Padaria Trigo Bom. Nada foi alterado."; text of css=.dialog (1): "Importar respostas de Padaria Trigo BomRascunho criadoAs respostas que Padaria Trigo Bom salvou em 23/10/2026 viraram um…"; css=[data-aioson-id="imported-draft"] is visible; eval → true
- Visible result: visible: css=.tour-pop; css=.tour-pop contains "Relatórios em PDF"; hidden: css=.tour-pop; visible: css=[data-aioson-primary]; css=.pages .paper = 5; visible: css=.paper[aria-label*="Resumo executivo"]; visible: css=.matrix; css=.pages .paper = 6; visible: css=.paper[aria-label*="Respostas do questionário"]; css=.dialog contains "padaria-trigo-bom-2026-08-27.pdf"; visible: css=[data-aioson-id="export-saved"]; visible: css=[data-aioson-id="open-pdf"]; visible: css=[data-aioson-id="show-folder"]; css=[data-aioson-id="export-notice"] contains "PDF salvo em Downloads"; visible: css=.paper[aria-label*="Antes e depois"]; css=.paper[aria-label*="Antes e depois"] contains "1 → 2"; visible: css=.dialog [role="alert"]; visible: css=[data-aioson-id="export-saved"]; visible: css=[data-aioson-id="reports-empty"]; visible: css=#b-email[aria-invalid="true"]; css=#e-logo contains "Use uma imagem PNG ou JPG"; css=.cover-preview .cover-brand contains "Rumo Consultoria"; css=.pages .paper >> nth=0 contains "Rumo Consultoria"; css=.pages .paper >> nth=1 contains "Rumo Consultoria"; page shows "Continua do diagnóstico de 20/04/2026"; page shows "Vencida em 15/10/2026"; css=[data-aioson-id="reeval-line"] contains "faltam 32 dias"; visible: css=[data-aioson-id="closed-actions"]; css=.toasts contains "agora está em andamento"; css=#e-due contains "Data inválida"; css=[data-aioson-id="action-d2-teste"] contains "Prazo 15/11/2026"; css=[data-aioson-id="action-d2-teste"] contains "Consultor"; page shows "Custo por cliente medido"; css=#e-month contains "já está anotado"; visible: css=[data-aioson-id="month-2026-10"]; css=[data-aioson-id="month-2026-10"] contains "R$ 40,00"; visible: role=dialog[name=/Excluir outubro de 2026/]; hidden: css=[data-aioson-id="month-2026-10"]; visible: css=[data-aioson-id="diary-empty"]; page shows "Refazer o diagnóstico"; visible: css=[data-aioson-id="home-diary-widget"]; page shows "Sua carteira"; visible: css=.paper[aria-label*="Empresas por estágio"]; css=.dialog contains "abre no navegador do computador"; css=.dialog contains "questionario-padaria-trigo-bom.html"; visible: css=[data-aioson-id="desktop-note"]; page shows "Revise e salve"; visible: css=[data-aioson-id="client-saved"]; css=.dialog [role="alert"] contains "não de Padaria Trigo Bom"; css=.dialog contains "Rascunho criado"; visible: css=[data-aioson-id="imported-draft"]

## Steps

| # | Action | Ids | Result | Detail | ms |
|---|---|---|---|---|---|
| 0 | goto |  | ok | navigated to file:///C:/dev/playapps/v-stage/.aioson/briefings/relatorios-e-acompanhamento/prototype.html | 446 |
| 1 | expect | PROM-002 | ok | css=.tour-pop is visible | 115 |
| 2 | expect css=.tour-pop | PROM-001 | ok | text of css=.tour-pop (1): "Relatórios em PDFEsta é a prévia do PDF, página por página: capa, resumo, gráfico das 8 dimensões e riscos. "Exportar PD…" | 142 |
| 3 | click role=button[name="Pular"] |  | ok | click role=button[name="Pular"] | 368 |
| 4 | expect |  | ok | css=.tour-pop is not visible | 3 |
| 5 | expect | PROM-001, PROM-004 | ok | css=[data-aioson-primary] is visible | 3 |
| 6 | expect css=.pages .paper | PROM-002, PROM-004 | ok | css=.pages .paper count = 5 | 45 |
| 7 | expect | PROM-002, PROM-004 | ok | css=.paper[aria-label*="Resumo executivo"] is visible | 4 |
| 8 | expect | PROM-002, PROM-004 | ok | css=.matrix is visible | 3 |
| 9 | check css=[data-change="rep-answers"] | PROM-004 | ok | check css=[data-change="rep-answers"] | 355 |
| 10 | expect css=.pages .paper | PROM-004 | ok | css=.pages .paper count = 6 | 58 |
| 11 | expect | PROM-004 | ok | css=.paper[aria-label*="Respostas do questionário"] is visible | 4 |
| 12 | click css=[data-aioson-id="report-export"] | PROM-001 | ok | click css=[data-aioson-id="report-export"] | 379 |
| 13 | expect css=.dialog | PROM-001 | ok | text of css=.dialog (1): "Exportar o relatório do diagnóstico em PDFPadaria Trigo Bom · diagnóstico de 27/08/2026 · 6 páginas · com as respostasAr…" | 5 |
| 14 | click css=[data-aioson-id="export-confirm"] | PROM-001 | ok | click css=[data-aioson-id="export-confirm"] | 451 |
| 15 | expect | PROM-001 | ok | css=[data-aioson-id="export-saved"] is visible | 1027 |
| 16 | expect | PROM-001, PROM-004 | ok | css=[data-aioson-id="open-pdf"] is visible | 59 |
| 17 | expect | PROM-001, PROM-004 | ok | css=[data-aioson-id="show-folder"] is visible | 3 |
| 18 | click css=[data-aioson-id="open-pdf"] |  | ok | click css=[data-aioson-id="open-pdf"] | 818 |
| 19 | expect css=[data-aioson-id="export-notice"] | PROM-001 | ok | text of css=[data-aioson-id="export-notice"] (1): "PDF salvo em Downloads: padaria-trigo-bom-2026-08-27.pdf" | 67 |
| 20 | click css=[data-aioson-id="type-evo"] | PROM-004 | ok | click css=[data-aioson-id="type-evo"] | 384 |
| 21 | expect | PROM-004 | ok | css=.paper[aria-label*="Antes e depois"] is visible | 65 |
| 22 | expect css=.paper[aria-label*="Antes e depois"] | PROM-004 | ok | text of css=.paper[aria-label*="Antes e depois"] (1): "Antes e depois         1 → 2Subiu um degrau: Descoberta para Ajuste— → R$ 82Custo por cliente32 → 53Média das 8 dimensõe…" | 8 |
| 23 | goto |  | ok | navigated to file:///C:/dev/playapps/v-stage/.aioson/briefings/relatorios-e-acompanhamento/prototype.html | 3 |
| 24 | expect | PROM-001 | ok | css=.dialog [role="alert"] is visible | 52 |
| 25 | click role=button[name="Tentar de novo"] |  | ok | click role=button[name="Tentar de novo"] | 257 |
| 26 | expect | PROM-001 | ok | css=[data-aioson-id="export-saved"] is visible | 908 |
| 27 | press |  | ok | pressed Escape | 63 |
| 28 | goto |  | ok | navigated to file:///C:/dev/playapps/v-stage/.aioson/briefings/relatorios-e-acompanhamento/prototype.html | 2 |
| 29 | expect | PROM-004 | ok | css=[data-aioson-id="reports-empty"] is visible | 74 |
| 30 | goto |  | ok | navigated to file:///C:/dev/playapps/v-stage/.aioson/briefings/relatorios-e-acompanhamento/prototype.html | 3 |
| 31 | fill css=#b-email |  | ok | filled css=#b-email with "marina@" | 70 |
| 32 | click css=[data-aioson-id="brand-save"] |  | ok | click css=[data-aioson-id="brand-save"] | 446 |
| 33 | expect | PROM-008 | ok | css=#b-email[aria-invalid="true"] is visible | 3 |
| 34 | click role=button[name="Simular arquivo SVG"] |  | ok | click role=button[name="Simular arquivo SVG"] | 380 |
| 35 | expect css=#e-logo | PROM-008 | ok | text of css=#e-logo (1): "Use uma imagem PNG ou JPG. Arquivos SVG não são aceitos." | 5 |
| 36 | click role=button[name="Preencher com um exemplo"] |  | ok | click role=button[name="Preencher com um exemplo"] | 314 |
| 37 | click css=[data-aioson-id="brand-save"] | PROM-008 | ok | click css=[data-aioson-id="brand-save"] | 337 |
| 38 | expect css=.cover-preview .cover-brand | PROM-008 | ok | text of css=.cover-preview .cover-brand (1): "Rumo Consultoria(11) 98877-6655 · marina@rumoconsultoria.com.br · rumoconsultoria.com.br" | 5 |
| 39 | goto |  | ok | navigated to file:///C:/dev/playapps/v-stage/.aioson/briefings/relatorios-e-acompanhamento/prototype.html | 67 |
| 40 | expect css=.pages .paper >> nth=0 | PROM-008 | ok | text of css=.pages .paper >> nth=0 (1): "Rumo Consultoria(11) 98877-6655 · marina@rumoconsultoria.com.br · rumoconsultoria.com.brRelatório de evoluçãoPadaria Tri…" | 135 |
| 41 | expect css=.pages .paper >> nth=1 | PROM-008 | ok | text of css=.pages .paper >> nth=1 (1): "Antes e depois         1 → 2Subiu um degrau: Descoberta para Ajuste— → R$ 82Custo por cliente32 → 53Média das 8 dimensõe…" | 72 |
| 42 | goto |  | ok | navigated to file:///C:/dev/playapps/v-stage/.aioson/briefings/relatorios-e-acompanhamento/prototype.html | 3 |
| 43 | expect | PROM-005, PROM-003 | ok | "Continua do diagnóstico de 20/04/2026" found 1× | 61 |
| 44 | expect | PROM-005 | ok | "Vencida em 15/10/2026" found 1× | 5 |
| 45 | expect css=[data-aioson-id="reeval-line"] | PROM-005, PROM-003 | ok | text of css=[data-aioson-id="reeval-line"] (1): "Refazer em 25/11/2026 · faltam 32 dias" | 62 |
| 46 | expect | PROM-005 | ok | css=[data-aioson-id="closed-actions"] is visible | 69 |
| 47 | select css=[data-aioson-id="status-d2-teste"] | PROM-005 | ok | selected "doing" in css=[data-aioson-id="status-d2-teste"] | 77 |
| 48 | expect css=.toasts | PROM-005 | ok | text of css=.toasts (1): "Marca salva. Os próximos PDFs saem com ela."Testar um anúncio com orçamento pequeno" agora está em andamento.Desfazer" | 127 |
| 49 | click css=[data-aioson-id="edit-d2-teste"] | PROM-005 | ok | click css=[data-aioson-id="edit-d2-teste"] | 416 |
| 50 | fill css=#a-due |  | ok | filled css=#a-due with "31022026" | 72 |
| 51 | click css=#act-form button[type=submit] |  | ok | click css=#act-form button[type=submit] | 529 |
| 52 | expect css=#e-due | PROM-005 | ok | text of css=#e-due (1): "Data inválida. Use DD/MM/AAAA, por exemplo 15/11/2026." | 67 |
| 53 | fill css=#a-due |  | ok | filled css=#a-due with "15112026" | 145 |
| 54 | select css=#a-role | PROM-005 | ok | selected "Consultor" in css=#a-role | 9 |
| 55 | click css=#act-form button[type=submit] |  | ok | click css=#act-form button[type=submit] | 524 |
| 56 | expect css=[data-aioson-id="action-d2-teste"] | PROM-005 | ok | text of css=[data-aioson-id="action-d2-teste"] (1): "03     Testar um anúncio com orçamento pequenoUm teste curto mostra se o canal traz cliente pelo custo que você aguenta.…" | 4 |
| 57 | expect css=[data-aioson-id="action-d2-teste"] | PROM-005 | ok | text of css=[data-aioson-id="action-d2-teste"] (1): "03     Testar um anúncio com orçamento pequenoUm teste curto mostra se o canal traz cliente pelo custo que você aguenta.…" | 64 |
| 58 | goto |  | ok | navigated to file:///C:/dev/playapps/v-stage/.aioson/briefings/relatorios-e-acompanhamento/prototype.html | 67 |
| 59 | expect | PROM-006, PROM-003 | ok | "Custo por cliente medido" found 1× | 64 |
| 60 | click css=[data-aioson-id="add-month"] >> nth=0 | PROM-006 | ok | click css=[data-aioson-id="add-month"] >> nth=0 | 327 |
| 61 | fill css=#m-month |  | ok | filled css=#m-month with "092026" | 9 |
| 62 | fill css=#m-cust |  | ok | filled css=#m-cust with "30" | 63 |
| 63 | fill css=#m-ads |  | ok | filled css=#m-ads with "120000" | 66 |
| 64 | click css=[data-aioson-id="month-save"] |  | ok | click css=[data-aioson-id="month-save"] | 4289 |
| 65 | expect css=#e-month | PROM-006 | ok | text of css=#e-month (1): "Setembro de 2026 já está anotado. Edite o mês na lista." | 64 |
| 66 | fill css=#m-month |  | ok | filled css=#m-month with "102026" | 8 |
| 67 | click css=[data-aioson-id="month-save"] | PROM-006 | ok | click css=[data-aioson-id="month-save"] | 330 |
| 68 | expect | PROM-006 | ok | css=[data-aioson-id="month-2026-10"] is visible | 3 |
| 69 | expect css=[data-aioson-id="month-2026-10"] | PROM-006 | ok | text of css=[data-aioson-id="month-2026-10"] (1): "out/2026     R$ 1.200,00gasto em 1 parte     30clientes novos     R$ 40,00por cliente     EditarExcluir" | 3 |
| 70 | click css=[data-aioson-id="month-2026-10"] [data-act="delete-month… | PROM-006 | ok | click css=[data-aioson-id="month-2026-10"] [data-act="delete-month"] | 331 |
| 71 | expect | PROM-006 | ok | role=dialog[name=/Excluir outubro de 2026/] is visible | 5 |
| 72 | click role=button[name="Excluir mês"] |  | ok | click role=button[name="Excluir mês"] | 700 |
| 73 | expect | PROM-006 | ok | css=[data-aioson-id="month-2026-10"] is not visible | 2 |
| 74 | goto |  | ok | navigated to file:///C:/dev/playapps/v-stage/.aioson/briefings/relatorios-e-acompanhamento/prototype.html | 3 |
| 75 | expect | PROM-006 | ok | css=[data-aioson-id="diary-empty"] is visible | 65 |
| 76 | goto |  | ok | navigated to file:///C:/dev/playapps/v-stage/.aioson/briefings/relatorios-e-acompanhamento/prototype.html | 68 |
| 77 | expect | PROM-005, PROM-003 | ok | "Refazer o diagnóstico" found 1× | 75 |
| 78 | expect | PROM-006, PROM-003 | ok | css=[data-aioson-id="home-diary-widget"] is visible | 5 |
| 79 | click css=[data-aioson-id="mode-toggle"] |  | ok | click css=[data-aioson-id="mode-toggle"] | 330 |
| 80 | expect | PROM-004 | ok | "Sua carteira" found 1× | 3 |
| 81 | click css=[data-aioson-id="home-portfolio-report"] | PROM-004 | ok | click css=[data-aioson-id="home-portfolio-report"] | 598 |
| 82 | expect | PROM-004 | ok | css=.paper[aria-label*="Empresas por estágio"] is visible | 53 |
| 83 | goto |  | ok | navigated to file:///C:/dev/playapps/v-stage/.aioson/briefings/relatorios-e-acompanhamento/prototype.html | 4 |
| 84 | click css=[data-aioson-id="send-questionnaire"] | PROM-007 | ok | click css=[data-aioson-id="send-questionnaire"] | 390 |
| 85 | expect css=.dialog | PROM-007 | ok | text of css=.dialog (1): "Enviar questionário para Padaria Trigo BomO FitPulse gera um arquivo que abre no navegador do computador do cliente, sem…" | 7 |
| 86 | click css=[data-aioson-id="send-generate"] | PROM-007 | ok | click css=[data-aioson-id="send-generate"] | 336 |
| 87 | expect css=.dialog | PROM-007 | ok | text of css=.dialog (1): "Arquivo geradoSalvo na pasta Downloadsquestionario-padaria-trigo-bom.htmlMande o arquivo com a mensagem que você copiou.…" | 762 |
| 88 | click role=link[name="Ver como o cliente vê"] |  | ok | click role=link[name="Ver como o cliente vê"] | 270 |
| 89 | expect | PROM-007 | ok | css=[data-aioson-id="desktop-note"] is visible | 3 |
| 90 | fill css=#cq-spend |  | ok | filled css=#cq-spend with "315000" | 58 |
| 91 | click role=button[name="Próximo bloco"] |  | ok | click role=button[name="Próximo bloco"] | 334 |
| 92 | click css=.rail [data-i="7"] |  | ok | click css=.rail [data-i="7"] | 350 |
| 93 | click role=button[name="Revisar"] |  | ok | click role=button[name="Revisar"] | 392 |
| 94 | expect | PROM-007 | ok | "Revise e salve" found 1× | 3 |
| 95 | click css=[data-aioson-id="client-save"] | PROM-007 | ok | click css=[data-aioson-id="client-save"] | 333 |
| 96 | expect | PROM-007 | ok | css=[data-aioson-id="client-saved"] is visible | 918 |
| 97 | goto |  | ok | navigated to file:///C:/dev/playapps/v-stage/.aioson/briefings/relatorios-e-acompanhamento/prototype.html | 3 |
| 98 | click css=[data-aioson-id="import-answers"] | PROM-007 | ok | click css=[data-aioson-id="import-answers"] | 345 |
| 99 | click css=[data-act="import-pick"][data-i="1"] |  | ok | click css=[data-act="import-pick"][data-i="1"] | 720 |
| 100 | expect css=.dialog [role="alert"] | PROM-007 | ok | text of css=.dialog [role="alert"] (1): "Não foi possível importarEste arquivo é de Ateliê Linha Fina, não de Padaria Trigo Bom. Nada foi alterado." | 878 |
| 101 | click role=button[name="Escolher outro arquivo"] |  | ok | click role=button[name="Escolher outro arquivo"] | 276 |
| 102 | click css=[data-act="import-pick"][data-i="0"] | PROM-007 | ok | click css=[data-act="import-pick"][data-i="0"] | 277 |
| 103 | expect css=.dialog | PROM-007 | ok | text of css=.dialog (1): "Importar respostas de Padaria Trigo BomRascunho criadoAs respostas que Padaria Trigo Bom salvou em 23/10/2026 viraram um…" | 748 |
| 104 | click role=button[name="Fechar"] |  | ok | click role=button[name="Fechar"] | 269 |
| 105 | expect | PROM-007 | ok | css=[data-aioson-id="imported-draft"] is visible | 3 |
| 106 | eval | PROM-002 | ok | eval → true | 3 |

