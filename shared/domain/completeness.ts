import {
  allowsUnknown,
  ANCHOR_MAX,
  BLOCK_COUNT,
  questionsOfBlock,
  type Question,
} from "../content/questionBank.ts";
import { isCents, resolveSpendCents } from "./unitEconomics.ts";
import {
  NEW_CUSTOMERS_RANGE_KEYS,
  PURCHASES_PER_YEAR_KEYS,
  RELATIONSHIP_LENGTH_KEYS,
  SPEND_RANGE_KEYS,
  type Answers,
  type BlockNumber,
  type CalculatorInput,
  type EntryMode,
} from "./types.ts";

const CALCULATOR_BLOCK: BlockNumber = 1;
const MARGIN_MAX_PERCENT = 100;

function isOneOf<Key extends string>(keys: readonly Key[], value: unknown): boolean {
  return typeof value === "string" && (keys as readonly string[]).includes(value);
}

// "Não sei" (`unknown`) is a complete answer; exact and range need their own value.
function isEntryComplete(mode: EntryMode | null, hasExactValue: boolean, hasRangeValue: boolean): boolean {
  if (mode === "unknown") return true;
  if (mode === "exact") return hasExactValue;
  if (mode === "range") return hasRangeValue;
  return false;
}

/** Block 1 ("Seus números") is complete when all six fields hold a usable value (AC-dm-14). */
export function isCalculatorComplete(calculator: CalculatorInput): boolean {
  const spendDone = isEntryComplete(
    calculator.spendMode,
    resolveSpendCents(calculator) !== null,
    isOneOf(SPEND_RANGE_KEYS, calculator.spendRange),
  );
  const newCustomersDone = isEntryComplete(
    calculator.newCustomersMode,
    isCents(calculator.newCustomers),
    isOneOf(NEW_CUSTOMERS_RANGE_KEYS, calculator.newCustomersRange),
  );
  const margin = calculator.marginPercent;
  const marginDone =
    typeof margin === "number" && Number.isInteger(margin) && margin >= 0 && margin <= MARGIN_MAX_PERCENT;
  return (
    spendDone &&
    newCustomersDone &&
    isCents(calculator.averagePurchaseCents) &&
    isOneOf(PURCHASES_PER_YEAR_KEYS, calculator.purchasesPerYear) &&
    isOneOf(RELATIONSHIP_LENGTH_KEYS, calculator.relationshipLength) &&
    marginDone
  );
}

// A missing key is unanswered; `null` ("não sei") only counts where the catalog offers it.
function isQuestionAnswered(question: Question, answers: Answers): boolean {
  const value = answers[question.id];
  if (value === null) return allowsUnknown(question.id);
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= ANCHOR_MAX;
}

export function isBlockComplete(
  block: BlockNumber,
  answers: Answers,
  calculator: CalculatorInput,
): boolean {
  if (block === CALCULATOR_BLOCK) return isCalculatorComplete(calculator);
  return questionsOfBlock(block).every((question) => isQuestionAnswered(question, answers));
}

/**
 * Blocks (1 to 8, ascending) that still have unanswered items. Used by the
 * completion gate on screen and by the server before it concludes (AC-dm-14).
 */
export function pendingBlocks(answers: Answers, calculator: CalculatorInput): BlockNumber[] {
  const pending: BlockNumber[] = [];
  for (let block = 1; block <= BLOCK_COUNT; block += 1) {
    if (!isBlockComplete(block as BlockNumber, answers, calculator)) pending.push(block as BlockNumber);
  }
  return pending;
}
