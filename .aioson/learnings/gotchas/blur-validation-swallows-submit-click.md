---
title: Validação no blur que insere mensagem desloca o botão e engole o clique de enviar
scope: formulários (assistente de primeiro uso, cadastro de empresa, calculadora do questionário)
found_in: protótipo diagnostico-maturidade (walkthrough PROM-021), 2026-10-22
---

# Validação no blur engole o clique de enviar

**Sintoma.** Depois de corrigir um campo e clicar em "Começar o diagnóstico", nada acontece: o formulário não é enviado e a página continua igual.

**Causa.** A validação semântica roda no `blur` (CNPJ com dígito verificador). Ao clicar no botão:
1. o campo perde o foco no `mousedown`;
2. a mensagem de erro aparece ou some;
3. a altura do campo muda e o botão desce ou sobe;
4. o `mouseup` acontece em outro elemento, então não há `click` e não há `submit`.

Uma mensagem que quebra em duas linhas num campo estreito piora o efeito. Só reservar uma linha não resolve.

**Correção aplicada no protótipo:**
- No handler de `blur`, se `event.relatedTarget` é o botão de enviar/avançar (`type="submit"` ou dentro de `.form-foot`/`.modal-foot`/`.quiz-foot`), não renderizar o erro. A validação do envio cuida disso.
- Reservar a linha da mensagem (`.err` com altura mínima e `visibility:hidden` quando vazia) e manter a mensagem numa linha só ("CNPJ inválido. Formato: 00.000.000/0000-00.").
- Corrigir o campo limpa o próprio erro no `input`/`change`, sem esperar outro envio.

**Como pegar:** um walkthrough que preenche um campo inválido, corrige e clica em enviar logo em seguida. Um teste que valida campo por campo não pega esse defeito.
