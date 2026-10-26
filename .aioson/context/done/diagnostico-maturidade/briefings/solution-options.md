---
slug: diagnostico-maturidade
created_at: 2026-10-22
recommended: B
---

# Solution options — Diagnóstico de maturidade de crescimento (V-Stage)

> Exploratório. Nenhuma opção está aprovada aqui; @product escolhe.

**Restrições já fixadas pelo dono (2026-10-22):**
- App independente, inspirado no método, sem marca nem dados da V4.
- Instalado pela loja do AIOSON Play.
- Persona primária: dono de pequena empresa em self-service. Persona secundária: consultor com várias empresas.
- Histórico por empresa.
- SQLite local, sem aioson-auth.
- Express + React (Vite).

Por isso as opções variam em **forma de uso e profundidade**, não em stack.

## Option A — Calculadora fiel ao PRD (baseline)

- **Shape:** formulário único (dados da empresa, 4 Fits de 0 a 100 autodeclarados, 8 perguntas de pilares) → tela de resultado com estágio, barras, riscos e plano. Nada é guardado.
- **Operational surface:** nenhuma. Não existe Empresa nem Diagnóstico persistido.
- **Experience map:** abrir, preencher tudo de uma vez, ver o resultado. Fechar o app perde tudo.
- **Capability candidates:** motor de cálculo do PRD, depois de corrigidas as contradições de `motor-de-diagnostico.md`.

| Object | Parent / owner | Required actions | Management surface | Empty / error states |
|---|---|---|---|---|
| Diagnóstico (efêmero) | sessão | preencher, calcular | formulário único | campo inválido; nenhum risco detectado |

- **Value / Risk / Effort / Completeness:** baixo / baixo / baixo / **incompleto**. Viola a decisão de histórico por empresa e o caso "auditoria de carteira". Os 4 Fits são eco da autoavaliação (M-11). Fica como referência, não como candidata.

## Option B — Autodiagnóstico guiado com histórico (recomendada)

- **Shape:**
  - Wizard de primeira execução: o uso é "minha empresa" ou "consultoria"? Depois vem o cadastro mínimo da empresa e o modelo de vendas.
  - Questionário guiado em linguagem simples, por blocos (Indicadores, Fits, Pilares), com "não sei", ajuda contextual (o que é CAC/LTV e como estimar) e salvamento automático. Dá para sair e voltar.
  - Resultado com estágio, scores, riscos, plano de ação priorizado, nível de confiança dos dados e versão das regras.
  - Histórico por empresa com comparação entre diagnósticos.
  - Exportação de relatório (PDF) e backup (arquivo).
- **Operational surface:**

| Object | Parent / owner | Required actions | Management surface | Empty / error states |
|---|---|---|---|---|
| Perfil de uso | instalação | escolher no wizard; trocar depois | wizard + Configurações | primeiro uso → wizard obrigatório |
| Empresa | instalação | criar, listar, editar, arquivar/restaurar (excluir = anonimizar ou remover, por causa da LGPD) | Home (modo empresa: 1 empresa em destaque; modo consultoria: lista) + página da empresa | nenhuma empresa → wizard; arquivada → filtro "arquivadas" |
| Diagnóstico | Empresa | iniciar, responder, salvar rascunho, retomar, concluir, descartar rascunho, arquivar, duplicar como base do próximo | página da empresa (linha do tempo) + tela do questionário | rascunho abandonado; resposta inválida por campo; conclusão com muitos "não sei" → resultado com confiança baixa |
| Resultado | Diagnóstico (imutável após concluir) | ver, comparar com anterior, exportar PDF | tela de resultado + comparação | primeiro diagnóstico → sem comparação; nenhum risco → estado "sem riscos críticos" explícito |
| Plano de ação | Resultado | ver; (Optional V1) marcar ação como feita | seção do resultado | estágio sem ações → mensagem explícita |
| Backup | instalação | exportar tudo; importar | Configurações | arquivo inválido ou de versão mais nova → erro claro, sem sobrescrever |

- **Value / Risk / Effort / Completeness:** alto / médio (o motor de regras ainda tem decisões abertas) / médio / **completo para as duas personas**. A consultoria usa os mesmos objetos com várias empresas.

## Option C — Painel de crescimento contínuo

- **Shape:** B + **check-in mensal de números**:
  - O dono informa faturamento, investimento em mídia, clientes novos e clientes perdidos, e o app **calcula CAC, LTV e LTV:CAC sozinho**, em vez de perguntar "você conhece seu CAC?".
  - O estágio passa a ser sustentado por dados ao longo do tempo, não só pelo questionário.
  - O plano de ação vira checklist acompanhado, com lembrete de reavaliação.
- **Operational surface:** B + objeto **Registro mensal** (Empresa → mês; criar, editar, excluir; tabela por mês; vazio → "registre seu primeiro mês") + gráficos de evolução na home.
- **Value / Risk / Effort / Completeness:** muito alto para PME (resolve o "não sei meu CAC" do V1) / médio-alto (mais telas; qualidade dos dados declarados) / alto / completo, porém maior que um MICRO.

## Option D — Consultor-first

- **Shape:**
  - Home de portfólio: empresas por estágio, rascunhos pendentes, reavaliações vencidas, riscos críticos.
  - Relatório PDF com a marca do consultor.
  - **Ponte entre Plays por arquivo**: o cliente responde no Play dele e exporta as respostas, e o consultor importa, revisa e conclui. Isso cobre as "duas pontas" sem servidor central.
  - Comparação entre clientes.
- **Operational surface:** B + Identidade do consultor (logo e nome no relatório, em Configurações) + Importação de respostas (Empresa → Diagnóstico importado; validar, pré-visualizar e confirmar).
- **Value / Risk / Effort / Completeness:** alto para a persona secundária e baixo para a primária / médio (versão do arquivo trocado entre Plays) / médio / completo para consultoria.

## Comparison

| Option | Value | Risk | Effort | Completeness | Recommended |
|---|---|---|---|---|---|
| A — Calculadora fiel ao PRD | Baixo | Baixo | Baixo | Incompleto (sem histórico) | Não |
| B — Autodiagnóstico guiado + histórico | Alto | Médio | Médio | Completo para as 2 personas | **Sim (MVP)** |
| C — Painel contínuo | Muito alto (PME) | Médio-alto | Alto | Completo, escopo maior | V2 (o check-in mensal é o melhor candidato pós-MVP) |
| D — Consultor-first | Alto (consultor) | Médio | Médio | Completo para consultoria | Parcial: a ponte por arquivo e o PDF com marca como Optional V1 |

## Recommendation

**B como MVP**, porque:
- atende à decisão de histórico por empresa;
- serve às duas personas com os mesmos objetos;
- ataca os table stakes do mercado (wizard, salvar e retomar, resultado imediato com linguagem simples, plano, PDF);
- inclui o diferencial raro que é a **evolução entre diagnósticos** (o Pointerpro ainda marca isso como "later").

Duas peças de outras opções têm alto valor por custo baixo e ficam como **Optional V1** para @product pesar:
- de C, a **calculadora de CAC/LTV a partir de números simples** dentro do questionário, sem o check-in mensal;
- de D, a **exportação e importação de respostas por arquivo** entre Plays.

O check-in mensal (C) e a home de portfólio rica (D) ficam para V2.

Fontes: `researchs/ferramentas-diagnostico-mercado/summary.md` §1–2, `researchs/v4-company-metodo/summary.md` §7, `motor-de-diagnostico.md`.
