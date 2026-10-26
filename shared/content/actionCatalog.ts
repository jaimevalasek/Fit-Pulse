import type { ActionKey } from "../domain/types.ts";

export interface ActionInfo {
  key: ActionKey;
  title: string;
  /** Why it matters now. */
  reason: string;
  /** What to do, step by step. */
  howTo: string;
}

export const ACTION_CATALOG: Record<ActionKey, ActionInfo> = {
  cac: {
    key: "cac",
    title: "Descobrir quanto custa cada cliente novo",
    reason: "Sem esse número, qualquer aumento de anúncio é uma aposta.",
    howTo:
      "Durante 30 dias, anote o que gastou para atrair clientes e quantos compraram pela primeira vez. Divida um pelo outro.",
  },
  measure: {
    key: "measure",
    title: "Trocar a estimativa por um número medido",
    reason: "Para escalar, o custo de cada cliente precisa ser medido, não estimado.",
    howTo: "Registre gasto e clientes novos por 30 dias, canal por canal.",
  },
  mp: {
    key: "mp",
    title: "Perguntar a 10 clientes por que eles voltam, ou por que não voltaram",
    reason: "Quem volta a comprar mostra o que o produto resolve.",
    howTo: "Mande uma mensagem curta para 10 clientes de 3 a 6 meses atrás e anote as respostas.",
  },
  ratio: {
    key: "ratio",
    title: "Aumentar o que cada cliente deixa antes de atrair mais gente",
    reason: "Hoje cada cliente deixa menos de 3 vezes o que custou.",
    howTo: "Teste um combo ou uma oferta de recompra para quem já comprou e meça por 30 dias.",
  },
  payback: {
    key: "payback",
    title: "Recuperar mais rápido o custo de cada cliente",
    reason: "O dinheiro gasto para atrair um cliente demora mais de um ano para voltar.",
    howTo: "Crie uma segunda compra para os primeiros 60 dias.",
  },
  pc: {
    key: "pc",
    title: "Medir o resultado de cada canal todo mês",
    reason: "Sem saber o que cada canal traz, o orçamento vai para o canal errado.",
    howTo: 'Pergunte "como nos conheceu?" em toda venda e some por canal no fim do mês.',
  },
  re: {
    key: "re",
    title: "Falar com quem já comprou, 15 dias depois da compra",
    reason: "Vender de novo custa menos do que conquistar alguém novo.",
    howTo:
      "Junte nome e contato de quem comprou nos últimos 6 meses e mande uma sugestão de recompra.",
  },
  mm: {
    key: "mm",
    title: "Conferir se o seu mercado comporta a sua meta",
    reason: "A meta pode exigir clientes demais para a sua região ou nicho.",
    howTo:
      "Estime os clientes possíveis e quantos você precisaria ter; acima de 30%, amplie a região ou a oferta.",
  },
  co: {
    key: "co",
    title: "Encurtar o caminho até o pagamento",
    reason: "Vendas se perdem entre o interesse e o pagamento.",
    howTo: "Liste cada passo de uma compra e corte um deles nesta semana.",
  },
  aq: {
    key: "aq",
    title: "Anotar a origem de cada cliente",
    reason: "Sem a origem, não dá para saber o que funciona.",
    howTo:
      'Inclua a pergunta "como nos conheceu?" no atendimento e registre numa planilha.',
  },
  en: {
    key: "en",
    title: "Criar um lugar claro para a sua oferta principal",
    reason: "Quem chega não encontra com facilidade como comprar.",
    howTo:
      "Monte uma página ou um catálogo de WhatsApp com preço, fotos e um botão de contato.",
  },
  es: {
    key: "es",
    title: "Dar um responsável para marketing e outro para vendas",
    reason: "Crescer mais depende de dividir o trabalho.",
    howTo: "Escreva o que cada função entrega por semana e quem responde por isso.",
  },
  dep: {
    key: "dep",
    title: "Testar um segundo canal com orçamento pequeno",
    reason: "Mais de 70% dos clientes vêm de um só lugar.",
    howTo:
      "Separe 10% do orçamento por 60 dias para um canal novo e compare o custo por cliente.",
  },
  invest: {
    key: "invest",
    title: "Aumentar aos poucos o investimento no canal que mais traz clientes",
    reason: "Os números sustentam crescer com mais divulgação.",
    howTo:
      "Aumente 20% por mês no canal com menor custo por cliente e pare se a relação cair abaixo de 3.",
  },
};

export function getActionInfo(key: ActionKey): ActionInfo {
  return ACTION_CATALOG[key];
}
