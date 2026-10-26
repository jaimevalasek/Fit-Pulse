# Expansion Scout - Diagnóstico de maturidade de crescimento (V-Stage)

## Why Scout
- **Trigger:** o dono pediu explicitamente para "expandir a ideia e detalhar". A superfície é rica: diagnóstico com uso repetido, histórico, dashboard de resultado, duas personas, operação em portfólio no modo consultoria.
- **Prior expansion artifacts found:** nenhum (`.aioson/briefings/diagnostico-maturidade/` foi criado nesta sessão; não existe `.aioson/context/features/diagnostico-maturidade/`).

## Possibility Map

| Candidate | User moment and mechanism | Before → after value | Evidence or hypothesis | Cost / downside | Bucket / disposition | Observable check |
|---|---|---|---|---|---|---|
| Wizard de primeira execução | Abre o app recém-instalado → escolhe o uso (minha empresa / consultoria) → cadastra a empresa em 3 campos → cai direto no 1º diagnóstico | Antes: tela vazia, sem saber por onde começar. Depois: em 1 minuto está respondendo | Pedido do dono (2026-10-22); NN/g recomenda wizard para usuário novato ou processo infrequente | Baixo | Core | Instalação limpa → primeiro diagnóstico iniciado sem nenhuma tela de configuração técnica |
| "Não sei" + nível de confiança | Na pergunta "qual seu CAC?", o dono escolhe "não sei" → o resultado mostra o estágio com confiança baixa e explica o motivo | Antes: chute ou valor inventado distorce o estágio. Depois: o resultado é honesto e a falta de dado vira a 1ª ação do plano | Pesquisa de design de autoavaliação (`researchs/growth-frameworks-diagnostico/summary.md`); RF-01 do PRD já trata ausência de CAC/LTV como V1 | Baixo | Core | Diagnóstico com ≥ 30% de "não sei" exibe o selo de confiança baixa e a ação "medir X" |
| Calculadora de CAC/LTV embutida | O dono não sabe o CAC → abre "calcular agora" → informa investimento em marketing/vendas do mês e clientes novos (+ ticket médio, margem e tempo médio de cliente para o LTV) → o app preenche o valor e mostra LTV:CAC | Antes: ele cai em V1 só porque não conhece a sigla. Depois: descobre o próprio número e aprende o conceito | Hipótese; fórmulas públicas (CAC = gasto ÷ clientes novos; LTV = ticket × margem × tempo de vida) | Médio (validação dos números, explicação) | Recommended MVP | Com entradas conhecidas, o CAC/LTV calculado bate com a fórmula; LTV:CAC < 3 aciona risco |
| Salvar e retomar | O dono para no meio do questionário → fecha o Play → volta dias depois e continua do ponto em que parou | Antes: perde as respostas e desiste. Depois: conclui | NN/g (wizards); Pointerpro "save per question" | Baixo (rascunho no SQLite) | Core | Fechar e reabrir o app preserva todas as respostas do rascunho |
| Resultado com plano priorizado pelos pontos fracos | A tela de resultado lista 3 a 5 ações ordenadas pelo pior Pilar/Fit e pelos riscos críticos, não só pelo estágio | Antes: plano genérico igual para todo V2/V3/V4 (M-26, M-27). Depois: ações que dependem das respostas | Pedowitz (quick wins de 30 dias + plano de 90 dias); M-27 | Médio (catálogo de ações por dimensão) | Core | Dois diagnósticos no mesmo estágio com pilares diferentes geram planos diferentes |
| Comparação entre diagnósticos | 3 meses depois, o dono refaz → vê "Estágio 1 → 2", deltas por Pilar/Fit e riscos resolvidos | Antes: não sabe se evoluiu. Depois: prova de progresso | Lacuna de mercado (Pointerpro "later"); decisão de histórico do dono | Médio | Recommended MVP | 2º diagnóstico concluído mostra o delta de cada dimensão contra o anterior |
| Versão das regras gravada | Uma atualização do app muda a fórmula → os diagnósticos antigos continuam com a nota original e indicam "regras v1" | Antes: notas antigas mudam em silêncio e a comparação mente. Depois: histórico confiável | Fluxo de update do Play (`software-update-compatibility.md` §10.1); M-29 | Baixo | Core | Após trocar a versão das regras, o resultado antigo exibe a mesma nota e o rótulo da versão |
| Exportar relatório (PDF) | O dono ou consultor gera um PDF do resultado para guardar ou enviar ao cliente/sócio | Antes: print de tela. Depois: entregável | Table stake do mercado (ScoreApp, Pointerpro) | Médio (layout de impressão) | Recommended MVP | O PDF contém estágio, scores, riscos, plano, data e versão das regras |
| Backup/exportação de dados | Configurações → "Exportar meus dados" (arquivo) e "Importar" | Antes: depende só do backup temporário do Play no update. Depois: o usuário controla a cópia (troca de computador) | O update do Play faz backup em temp; LGPD (portabilidade/eliminação) | Baixo-médio | Recommended MVP | Exportar → instalar em outro Play → importar → histórico idêntico |
| Ponte entre Plays (respostas por arquivo) | O cliente responde no Play dele → exporta → o consultor importa no Play dele, revisa e conclui | Cobre as "duas pontas" sem servidor | Decisão "ambos" do dono + "cada um usa o próprio Play" | Médio (compatibilidade de versão do arquivo) | Optional V1 | Arquivo exportado no Play A é importado no Play B e gera um rascunho idêntico |
| Home de decisão | A home mostra o estágio atual (foco), a dimensão mais fraca, o progresso do plano e a próxima reavaliação; no modo consultoria mostra empresas por estágio, rascunhos parados e reavaliações vencidas | Antes: menu ou lista vazia. Depois: sabe o que fazer hoje | Regra `management-home-widgets` | Médio | Recommended MVP | Mudar um diagnóstico altera os widgets correspondentes |
| Glossário/ajuda contextual | Ícone "?" em cada termo (CAC, LTV, Fit, Pilar) com explicação em 2 frases e um exemplo | Público não especialista entende o que responde | NN/g plain language (6º–8º ano) | Baixo | Core | Todo termo técnico da UI tem ajuda acessível por teclado |
| Lembrete de reavaliação | Na conclusão, o app sugere uma data (ex.: 90 dias) e a home avisa quando vencer | Hábito de reavaliar | Pedowitz (1 estágio em 6–12 meses) | Baixo | Optional V1 | Data vencida aparece como atenção na home |
| Check-in mensal de números | Todo mês, informa faturamento, mídia e clientes → CAC/LTV automáticos e gráficos | Diagnóstico vivo | Opção C | Alto | V2 / Later | — |
| Benchmark entre empresas | "Empresas do seu segmento estão no estágio 2" | Contexto competitivo | Cada instalação é isolada (SQLite local, sem nuvem): sem fonte de dados agregados | Alto + privacidade | V2 / Later (exige componente em nuvem); no modo consultoria, a média do próprio portfólio (com N visível) é Optional V1 | — |
| Plano gerado por IA (LLM) | Texto de plano personalizado por IA | Personalização | PRD L17 cita "motores de IA", mas não há entrada qualitativa | Custo por chamada, dependência de chave e de rede, alucinação | Cut List para o MVP (regras determinísticas primeiro) | — |
| Acompanhamento do PPA (7 componentes) | Workspace para executar persona, FOFA, benchmark etc. | Vira ferramenta de planejamento | PRD L40–48 | Alto; muda o produto de diagnóstico para planejamento; termos possivelmente internos da V4 | V2 / Later | — |

## Experience Map

| User moment / goal | Action or choice | System response / feedback | Success, failure and recovery | Evidence or hypothesis | Bucket / decision | Observable check |
|---|---|---|---|---|---|---|
| Instalou pela loja e abriu pela 1ª vez | Escolhe "minha empresa" ou "consultoria"; informa nome, segmento e modelo de vendas | Cria a empresa e oferece "começar diagnóstico (~10 min)" | Fecha no meio → reabre no mesmo passo | Pedido do dono | Core | Sem nenhum passo técnico (banco, login) |
| Responder sem ser especialista | Responde por blocos; usa "?" e "não sei"; usa a calculadora de CAC | Progresso por bloco; validação por campo; salvamento automático | Valor monetário inválido → mensagem no campo; nada se perde | NN/g; regra `form-fields-masks-and-validation` | Core | Campos de moeda com máscara BRL e erro inline |
| Ver o resultado | Conclui | Estágio com nome simples, por que caiu nele, Fits/Pilares, riscos (com "nenhum risco crítico" quando for o caso), plano de 3 a 5 ações, confiança | Muitos "não sei" → resultado marcado como provisório | M-21, M-27 | Core | Resultado sempre válido, mesmo sem riscos |
| Voltar meses depois | Abre a empresa → "novo diagnóstico" (pré-preenchido com o anterior) | Compara com o anterior ao concluir | Rascunho antigo pendente → retomar ou descartar | Decisão de histórico | Recommended MVP | Delta por dimensão visível |
| Consultor com vários clientes | Lista de empresas → filtra por estágio → abre o cliente | Mesmo fluxo, várias empresas | Arquivar cliente encerrado; restaurar | Persona secundária | Recommended MVP | Arquivar e restaurar sem perder o histórico |
| Entregar ao cliente/sócio | Exporta PDF | Arquivo salvo onde o usuário escolher | Falha ao salvar → mensagem e nova tentativa | Table stake | Recommended MVP | O PDF abre com todo o conteúdo do resultado |

## Operational Surface Map

| Object | Parent / owner | Lifecycle states | Required actions | Management surface | Empty / error states | Bucket |
|---|---|---|---|---|---|---|
| Perfil de uso | instalação | definido | escolher (wizard), trocar (Configurações) | wizard + Configurações | sem perfil → wizard | Core |
| Empresa | instalação | ativa, arquivada | criar, listar, editar, arquivar, restaurar, excluir/anonimizar | Home/lista + página da empresa | nenhuma → wizard; busca sem resultado | Core |
| Diagnóstico | Empresa | rascunho, concluído, arquivado | iniciar, salvar, retomar, concluir, descartar rascunho, arquivar, iniciar novo a partir do anterior | página da empresa (linha do tempo) + questionário | nenhum diagnóstico → CTA "fazer o primeiro"; rascunho órfão | Core |
| Resposta | Diagnóstico | — | responder, alterar enquanto for rascunho | questionário | inválida → erro por campo | Core |
| Resultado | Diagnóstico | imutável | ver, comparar, exportar PDF | tela de resultado | sem anterior → sem comparação; sem riscos → estado explícito | Core |
| Ação do plano | Resultado | sugerida, feita (Optional V1) | ver; marcar como feita | seção do resultado/home | nenhuma ação → mensagem | Core (ver) / Optional V1 (status) |
| Backup | instalação | — | exportar, importar | Configurações | arquivo inválido/mais novo → recusa sem sobrescrever | Recommended MVP |
| Catálogo de perguntas/regras | app (versionado) | versão N | não gerenciável pelo usuário (vem com o app) | — | — | Core (sem CRUD: imutável por versão) |

## Missing Management Surfaces

- O PRD não tem **Empresa** como entidade (`company_info.name` é texto solto). Com histórico, ela precisa de criar/listar/editar/arquivar/restaurar/excluir.
- O PRD não tem **lista nem linha do tempo de diagnósticos**: sem isso, o histórico decidido não é acessível.
- Não há **rascunho** no PRD: o questionário é um payload único. Retomar exige estado de rascunho e a ação "descartar".
- Não há tela de **Configurações** (perfil de uso, backup, identidade do consultor).
- Exclusão/anonimização de empresa (LGPD, art. 16) não existe.

## Likely MVP Shape

- **Core:** wizard de 1º uso, Empresa com gestão completa, Diagnóstico com rascunho/retomar/concluir, questionário guiado com "não sei" e ajuda, motor de regras determinístico com versão gravada, resultado com estágio/scores/riscos (incluindo vazio)/plano priorizado/confiança, glossário.
- **Recommended MVP:** comparação com o diagnóstico anterior, calculadora de CAC/LTV, home de decisão, exportação PDF, backup/importação.
- **Not enough evidence yet:** pesos e limiares do motor (a calibrar), número de perguntas por dimensão, nomes próprios dos estágios.

## Discussion Questions

- [decision-required] Os scores dos Fits vêm de perguntas ancoradas em evidência (recomendado) ou continuam autodeclarados de 0 a 100 como no PRD?
- [decision-required] Nomenclatura própria dos estágios e do produto (risco de marca de "V1–V4" e "V-Stage").
- [decision-required] Ponte entre Plays por arquivo entra no V1 ou fica para depois?
- [research-able] Qual Node o Play usa no runtime de apps instalados (compatibilidade do binário `better-sqlite3`)?
- [testable] Um dono de PME conclui o questionário em ≤ 15 minutos sem ajuda externa?

## Do Not Pull Into MVP Yet

- Check-in mensal de números e gráficos de evolução financeira (Opção C).
- Benchmark entre empresas de instalações diferentes (exige nuvem; privacidade).
- Plano gerado por IA.
- Workspace de execução do PPA.
- Multi-operador/RBAC na mesma instalação.

## Recommendation

Proceed to product definition? **Only after questions:** a fonte dos scores de Fit e a nomenclatura dos estágios mudam o questionário inteiro. Classificação: o escopo recomendado (gestão de Empresa e Diagnóstico, motor versionado, comparação, PDF, backup) fica acima de MICRO; **SMALL** é o enquadramento mais honesto para @product confirmar.
