import type {
  AnchorValue,
  BlockNumber,
  QuestionDimension,
  QuestionId,
} from "../domain/types.ts";

/** Highest anchor value; a question's best answer. */
export const ANCHOR_MAX = 3;

export const BLOCK_COUNT = 8;

export interface AnchorOption {
  value: AnchorValue;
  label: string;
}

export interface Question {
  id: QuestionId;
  block: BlockNumber;
  dimension: QuestionDimension;
  text: string;
  /** Text behind the "?" button: one or two plain sentences with an everyday example. */
  help: string;
  /** The four anchors, in order of value 0 to 3. */
  options: readonly [AnchorOption, AnchorOption, AnchorOption, AnchorOption];
  /** Label of the "não sei" / "não acompanho" option; `null` when the question has none. */
  unknownLabel: string | null;
}

export interface BlockInfo {
  number: BlockNumber;
  id: string;
  title: string;
  intro: string;
}

/** Block 1 is the calculator; blocks 2 to 8 hold the questions. */
export const BLOCKS: readonly BlockInfo[] = [
  {
    number: 1,
    id: "numeros",
    title: "Seus números",
    intro:
      "Com seis respostas, o app calcula quanto custa conquistar um cliente e quanto ele deixa ao longo do tempo. Se não souber um valor, escolha uma faixa.",
  },
  {
    number: 2,
    id: "clientes",
    title: "Clientes e produto",
    intro: "Se as pessoas voltam a comprar, o produto resolve algo de verdade.",
  },
  {
    number: 3,
    id: "canais",
    title: "Canais e preço",
    intro: "Por onde os clientes chegam e se o preço paga o esforço de trazê-los.",
  },
  {
    number: 4,
    id: "mercado",
    title: "Mercado e equipe",
    intro: "Se a sua meta cabe no seu mercado e como o trabalho está dividido.",
  },
  {
    number: 5,
    id: "atrair",
    title: "Atrair",
    intro: "Como as pessoas certas descobrem a sua empresa.",
  },
  {
    number: 6,
    id: "conversar",
    title: "Conversar",
    intro: "O que a pessoa encontra depois que conhece você.",
  },
  {
    number: 7,
    id: "vender",
    title: "Vender",
    intro: "O caminho entre o interesse e o pagamento.",
  },
  {
    number: 8,
    id: "manter",
    title: "Manter",
    intro: "O que acontece depois da primeira compra.",
  },
];

function anchors(
  zero: string,
  one: string,
  two: string,
  three: string,
): Question["options"] {
  return [
    { value: 0, label: zero },
    { value: 1, label: one },
    { value: 2, label: two },
    { value: 3, label: three },
  ];
}

export const QUESTION_BANK: readonly Question[] = [
  {
    id: "mp1",
    block: 2,
    dimension: "mp",
    text: "Dos clientes que compraram há uns 6 meses, quantos ainda compram de você?",
    help: "Pense nas pessoas que compraram há uns 6 meses. Quem volta a comprar mostra que o produto resolve algo de verdade.",
    options: anchors(
      "Menos de 1 em cada 4",
      "Cerca de 1 em cada 3",
      "Mais ou menos metade",
      "Mais da metade",
    ),
    unknownLabel: "Não acompanho",
  },
  {
    id: "mp2",
    block: 2,
    dimension: "mp",
    text: "Se você parasse toda a divulgação paga por um mês, as vendas…",
    help: "Divulgação paga inclui anúncios em redes sociais, Google, iFood patrocinado e panfleto pago.",
    options: anchors(
      "Iriam quase a zero",
      "Cairiam muito",
      "Cairiam um pouco",
      "Continuariam, por indicação e clientes antigos",
    ),
    unknownLabel: null,
  },
  {
    id: "mp3",
    block: 2,
    dimension: "mp",
    text: "De cada 10 clientes novos, quantos chegam por indicação ou procurando o seu nome?",
    help: "Indicação de amigo, alguém que já conhecia a marca ou digitou o nome da empresa na busca.",
    options: anchors("Nenhum ou 1", "2 ou 3", "4 a 6", "7 ou mais"),
    unknownLabel: "Não sei dizer",
  },
  {
    id: "mp4",
    block: 2,
    dimension: "mp",
    text: "Quando um cliente deixa de comprar, você sabe o motivo?",
    help: "Pense na última vez em que um cliente sumiu. Você perguntou o que aconteceu ou ficou só na suspeita?",
    options: anchors("Não sei", "Desconfio", "Pergunto às vezes", "Pergunto sempre e anoto"),
    unknownLabel: null,
  },
  {
    id: "pc1",
    block: 3,
    dimension: "pc",
    text: "Que parte dos clientes novos vem do seu principal canal?",
    help: "Canal é o lugar onde o cliente te encontra: Instagram, WhatsApp, iFood, Google, indicação, vitrine da loja.",
    options: anchors(
      "Não sei de onde eles vêm",
      "Vem um pouco de cada lugar",
      "Mais ou menos metade de um canal",
      "Mais de 70% de um canal só",
    ),
    unknownLabel: null,
  },
  {
    id: "pc2",
    block: 3,
    dimension: "pc",
    text: "Você sabe quanto cada canal custa e quantos clientes traz?",
    help: 'Por exemplo: "Instagram custou R$ 600 e trouxe 20 clientes este mês".',
    options: anchors(
      "Não sei",
      "Tenho uma ideia",
      "Anoto para alguns canais",
      "Anoto para todos, todo mês",
    ),
    unknownLabel: null,
  },
  {
    id: "pc3",
    block: 3,
    dimension: "pc",
    text: "Nos últimos 6 meses, você testou um canal novo medindo o resultado?",
    help: "Canal novo pode ser um grupo de WhatsApp, uma parceria ou um tipo de anúncio. Medir é anotar quantos clientes chegaram e quanto custou.",
    options: anchors(
      "Não testei",
      "Testei sem medir",
      "Testei e medi um",
      "Testo com frequência e meço",
    ),
    unknownLabel: null,
  },
  {
    id: "cm1",
    block: 3,
    dimension: "cm",
    text: "O lucro de um cliente novo paga o que você gastou para atraí-lo?",
    help: "Lucro aqui é o que sobra depois de pagar produto, insumo e entrega.",
    options: anchors(
      "Só depois de muitas compras, ou nunca",
      "Depois de várias compras",
      "Na segunda ou terceira compra",
      "Já na primeira compra",
    ),
    unknownLabel: "Não sei",
  },
  {
    id: "cm2",
    block: 3,
    dimension: "cm",
    text: "Você acompanha quanto sobra de cada venda (margem)?",
    help: "Margem é o que sobra de cada venda depois de pagar produto, insumo e entrega. Se vende por R$ 100 e sobram R$ 40, a margem é de 40%.",
    options: anchors("Não", "Tenho uma ideia", "Calculei uma vez", "Acompanho todo mês"),
    unknownLabel: null,
  },
  {
    id: "mm1",
    block: 4,
    dimension: "mm",
    text: "Para bater a sua meta, que parte dos clientes possíveis você precisaria conquistar?",
    help: "Clientes possíveis são as pessoas ou empresas da sua região ou nicho que poderiam comprar de você. Se a conta der mais de 30%, a meta pede um mercado maior.",
    options: anchors("Mais de 30%", "Entre 10% e 30%", "Entre 3% e 10%", "Menos de 3%"),
    unknownLabel: "Não sei calcular",
  },
  {
    id: "mm2",
    block: 4,
    dimension: "mm",
    text: "Você tem uma meta de faturamento para os próximos 12 meses?",
    help: "Meta é quanto você quer vender nos próximos 12 meses. Pode ser um valor por mês ou por ano.",
    options: anchors(
      "Não",
      "Tenho uma ideia",
      "Tenho um número",
      "Tenho um número por mês e acompanho",
    ),
    unknownLabel: null,
  },
  {
    id: "es1",
    block: 4,
    dimension: "structure",
    text: "Como o trabalho de marketing e vendas está dividido hoje?",
    help: "Esta resposta conta para o último estágio, quando crescer depende de ter responsáveis por área.",
    options: anchors(
      "Eu faço tudo",
      "Tenho ajuda de vez em quando",
      "Uma pessoa cuida disso comigo",
      "Áreas separadas, cada uma com responsável",
    ),
    unknownLabel: null,
  },
  {
    id: "aq1",
    block: 5,
    dimension: "aq",
    text: "Você sabe de onde veio cada cliente?",
    help: 'Basta perguntar "como você nos conheceu?" e anotar.',
    options: anchors(
      "Não sei",
      "Tenho uma ideia",
      "Pergunto às vezes",
      "Anoto a origem de cada cliente",
    ),
    unknownLabel: null,
  },
  {
    id: "aq2",
    block: 5,
    dimension: "aq",
    text: "Quantos canais trazem clientes todo mês, com resultado que você mede?",
    help: "Conte só os canais em que você sabe quantos clientes chegaram.",
    options: anchors("Nenhum constante", "Um", "Dois", "Três ou mais"),
    unknownLabel: null,
  },
  {
    id: "aq3",
    block: 5,
    dimension: "aq",
    text: "Você sabe quanto paga, em média, por cada pessoa interessada que chega (contato, orçamento ou visita)?",
    help: "Pessoa interessada é quem pede orçamento, manda mensagem ou visita a loja. Divida o gasto pelo número dessas pessoas.",
    options: anchors("Não", "Tenho uma ideia", "Calculo às vezes", "Acompanho todo mês"),
    unknownLabel: null,
  },
  {
    id: "en1",
    block: 6,
    dimension: "en",
    text: "Quem conhece a sua marca encontra um lugar claro para comprar ou pedir orçamento?",
    help: "Pode ser uma página, um catálogo no WhatsApp ou um link fixo na bio.",
    options: anchors(
      "Não tenho",
      "Só o perfil na rede social",
      "Uma página geral",
      "Uma página por oferta, com botão de contato",
    ),
    unknownLabel: null,
  },
  {
    id: "en2",
    block: 6,
    dimension: "en",
    text: "Com que frequência você publica algo útil para o seu cliente?",
    help: "Útil é o que ajuda a decidir: dica, bastidor, prova de cliente, tabela de preço.",
    options: anchors(
      "Quase nunca",
      "Quando sobra tempo",
      "Toda semana",
      "Toda semana, com calendário planejado",
    ),
    unknownLabel: null,
  },
  {
    id: "en3",
    block: 6,
    dimension: "en",
    text: "Quanto tempo você leva para responder quem pede orçamento ou informação?",
    help: "Conte desde a mensagem do cliente até a sua primeira resposta de verdade. Resposta automática não conta.",
    options: anchors("Mais de um dia", "No mesmo dia", "Em algumas horas", "Em até 1 hora"),
    unknownLabel: null,
  },
  {
    id: "co1",
    block: 7,
    dimension: "co",
    text: "De cada 10 orçamentos ou conversas sobre compra, quantos viram venda?",
    help: "Se você vende no balcão, pense em quem pergunta o preço e leva.",
    options: anchors("1 ou menos", "2 ou 3", "4 a 6", "7 ou mais"),
    unknownLabel: "Não acompanho",
  },
  {
    id: "co2",
    block: 7,
    dimension: "co",
    text: "Quando alguém decide comprar, quantos passos existem até pagar?",
    help: "Passos são mensagens, telas, formulários e esperas até o pagamento.",
    options: anchors(
      "Muitos, e perco vendas no caminho",
      "Alguns, às vezes travam",
      "Poucos",
      "Um clique ou um contato e pronto",
    ),
    unknownLabel: null,
  },
  {
    id: "co3",
    block: 7,
    dimension: "co",
    text: "Quando alguém não compra, você volta a falar com essa pessoa?",
    help: "Pense em quem pediu o preço e sumiu. Uma mensagem de lembrete, depois de alguns dias, já conta.",
    options: anchors(
      "Não",
      "Às vezes",
      "Sim, com uma mensagem padrão",
      "Sim, com um roteiro de retorno",
    ),
    unknownLabel: null,
  },
  {
    id: "re1",
    block: 8,
    dimension: "re",
    text: "Você tem a lista dos seus clientes com um contato?",
    help: "Nome e WhatsApp ou e-mail já bastam.",
    options: anchors(
      "Não tenho",
      "Tenho parte, espalhada",
      "Sim, numa planilha",
      "Sim, num sistema, atualizada",
    ),
    unknownLabel: null,
  },
  {
    id: "re2",
    block: 8,
    dimension: "re",
    text: "Depois da compra, você volta a falar com o cliente?",
    help: "Por exemplo: mensagem de agradecimento, aviso de novidade ou oferta de recompra.",
    options: anchors(
      "Não",
      "Às vezes",
      "Sim, quando tenho oferta",
      "Sim, com mensagens planejadas para recompra",
    ),
    unknownLabel: null,
  },
  {
    id: "re3",
    block: 8,
    dimension: "re",
    text: "Você tem algo que faz o cliente voltar (fidelidade, assinatura, pacote, lembrete)?",
    help: "Exemplos: cartão fidelidade, assinatura mensal, pacote de sessões ou um aviso de que está na hora de comprar de novo.",
    options: anchors("Não", "Já tentei", "Tenho um", "Tenho e meço quantos voltam"),
    unknownLabel: null,
  },
];

const QUESTIONS_BY_ID = new Map<QuestionId, Question>(
  QUESTION_BANK.map((question) => [question.id, question]),
);

export function getQuestion(id: QuestionId): Question {
  const question = QUESTIONS_BY_ID.get(id);
  if (!question) throw new Error(`Unknown question: ${id}`);
  return question;
}

export function isQuestionId(value: string): value is QuestionId {
  return QUESTIONS_BY_ID.has(value as QuestionId);
}

export function questionsOfBlock(block: BlockNumber): readonly Question[] {
  return QUESTION_BANK.filter((question) => question.block === block);
}

export function questionsOfDimension(dimension: QuestionDimension): readonly Question[] {
  return QUESTION_BANK.filter((question) => question.dimension === dimension);
}

/** True only for the fact questions that offer "não sei" / "não acompanho". */
export function allowsUnknown(id: QuestionId): boolean {
  return getQuestion(id).unknownLabel !== null;
}
