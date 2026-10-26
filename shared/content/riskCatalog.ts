import type { SignalId } from "../domain/types.ts";

export interface RiskInfo {
  id: SignalId;
  /** Title shown on the risk card. */
  title: string;
  /** Why the signal fired, in plain words. */
  cause: string;
  /** Text after "Como reduzir:". */
  howToReduce: string;
}

const RAISE_CUSTOMER_VALUE =
  "Teste um combo ou uma oferta de recompra para quem já comprou e meça por 30 dias.";

/** Catalog order matters: it breaks ties between risks with the same score (RULE-dm-07). */
export const RISK_CATALOG: readonly RiskInfo[] = [
  {
    id: "SIG-01",
    title: "Investir em divulgação sem saber quanto custa um cliente",
    cause: "O gasto ou o número de clientes novos não é conhecido.",
    howToReduce:
      "Durante 30 dias, anote o que gastou para atrair clientes e quantos compraram pela primeira vez.",
  },
  {
    id: "SIG-02",
    title: "Cada venda nova aumenta o prejuízo",
    cause: "Cada cliente deixa menos do que custou para ser conquistado.",
    howToReduce: RAISE_CUSTOMER_VALUE,
  },
  {
    id: "SIG-03",
    title: "Margem apertada para crescer com anúncio",
    cause: "Cada cliente deixa menos de 3 vezes o que custou.",
    howToReduce: RAISE_CUSTOMER_VALUE,
  },
  {
    id: "SIG-04",
    title: "Depender de um só canal",
    cause:
      "Mais de 70% dos clientes novos vêm do mesmo lugar. Se ele mudar as regras, as vendas caem.",
    howToReduce:
      "Separe 10% do orçamento por 60 dias para um canal novo e compare o custo por cliente.",
  },
  {
    id: "SIG-05",
    title: "Vender só para gente nova",
    cause: "Quase nada é feito para o cliente comprar de novo.",
    howToReduce:
      "Junte o contato de quem comprou nos últimos 6 meses e mande uma sugestão de recompra 15 dias depois da compra.",
  },
  {
    id: "SIG-06",
    title: "Caixa preso em clientes novos",
    cause: "O custo de um cliente leva mais de 12 meses para voltar.",
    howToReduce:
      "Crie uma segunda compra para os primeiros 60 dias, como um pacote ou uma assinatura.",
  },
  {
    id: "SIG-07",
    title: "Meta maior do que o mercado",
    cause: "A meta pede mais de 30% dos clientes possíveis.",
    howToReduce:
      "Estime quantos clientes possíveis existem; se a meta pede mais de 30%, amplie a região ou a oferta.",
  },
  {
    id: "SIG-08",
    title: "Vendas perdidas entre o interesse e o pagamento",
    cause: "Há muitos passos até pagar, e parte dos clientes desiste no caminho.",
    howToReduce:
      "Liste cada passo de uma compra e corte um deles nesta semana, como um link de pagamento direto.",
  },
];

export function getRiskInfo(id: SignalId): RiskInfo {
  const info = RISK_CATALOG.find((risk) => risk.id === id);
  if (!info) throw new Error(`Unknown risk signal: ${id}`);
  return info;
}

/** Position of a signal in the catalog (0-based). */
export function riskCatalogIndex(id: SignalId): number {
  return RISK_CATALOG.findIndex((risk) => risk.id === id);
}
