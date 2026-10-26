import {
  SPEND_PART_KEYS,
  type CalculatorInput,
  type CostOrigin,
  type DiaryFieldSource,
  type Rules,
  type UnitEconomics,
} from "./types.ts";

const MONTHS_PER_YEAR = 12;
const PERCENT = 100;
// Decimals kept on exact values so float noise never flips a threshold (3.0000000000000004 stays 3).
const EXACT_DECIMALS = 9;

interface Quantity {
  value: number | null;
  origin: CostOrigin;
}

const UNKNOWN_QUANTITY: Quantity = { value: null, origin: "unknown" };

interface CustomerProfit {
  /** Profit of one customer over the whole relationship, in cents (rounded). */
  lifetimeCents: number;
  /** Profit of one customer per month, in cents (exact). */
  monthlyExact: number;
}

/** Half-up rounding for non-negative values: 2.5 -> 3, 6000.4 -> 6000. */
export function roundHalfUp(value: number): number {
  return Math.floor(Number(value.toFixed(EXACT_DECIMALS)) + 0.5);
}

function roundExact(value: number): number {
  return Number(value.toFixed(EXACT_DECIMALS));
}

/** A money amount in whole cents, zero allowed (RULE-dm-12). */
export function isCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPercent(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= PERCENT;
}

// Reads a representative value of a range answer; an unknown key or a bad value is "not informed".
function lookupMidpoint(table: Record<string, number>, key: string | null | undefined): number | null {
  if (typeof key !== "string" || !Object.hasOwn(table, key)) return null;
  const value = table[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Sum of the cost parts the owner filled in; `null` when none is filled (an explicit 0 counts as filled). */
export function sumSpendParts(spendParts: CalculatorInput["spendParts"] | undefined): number | null {
  const parts = SPEND_PART_KEYS.map((key) => spendParts?.[key]).filter(isCents);
  const total = parts.reduce((sum, part) => sum + part, 0);
  return parts.length > 0 && Number.isSafeInteger(total) ? total : null;
}

/**
 * The exact spend in cents: the sum of the parts the owner filled in or, when no part is filled,
 * the single total ("Só sei o total" of the diary). `null` when neither is there.
 */
export function resolveSpendCents(
  calculator: Pick<CalculatorInput, "spendParts" | "spendTotalCents">,
): number | null {
  const fromParts = sumSpendParts(calculator.spendParts);
  if (fromParts !== null) return fromParts;
  return isCents(calculator.spendTotalCents) ? calculator.spendTotalCents : null;
}

// A number typed in is measured. One taken from a diary of less than 3 months is a projection
// and stays estimated (RULE-ra-09, AC-ra-45).
function exactOrigin(source: DiaryFieldSource | undefined): CostOrigin {
  return source?.origin === "estimated" ? "estimated" : "measured";
}

function resolveSpend(calculator: CalculatorInput, rules: Rules): Quantity {
  if (calculator.spendMode === "exact") {
    const total = resolveSpendCents(calculator);
    return total === null
      ? UNKNOWN_QUANTITY
      : { value: total, origin: exactOrigin(calculator.diarySource?.spend) };
  }
  if (calculator.spendMode === "range") {
    const midpoint = lookupMidpoint(rules.midpoints.spendCentsByRange, calculator.spendRange);
    return midpoint === null ? UNKNOWN_QUANTITY : { value: midpoint, origin: "estimated" };
  }
  return UNKNOWN_QUANTITY;
}

function resolveNewCustomers(calculator: CalculatorInput, rules: Rules): Quantity {
  if (calculator.newCustomersMode === "exact") {
    // 0 is a valid answer (BR-dm-14): the cost per customer just cannot be calculated.
    return isCents(calculator.newCustomers)
      ? { value: calculator.newCustomers, origin: exactOrigin(calculator.diarySource?.newCustomers) }
      : UNKNOWN_QUANTITY;
  }
  if (calculator.newCustomersMode === "range") {
    const midpoint = lookupMidpoint(rules.midpoints.newCustomersByRange, calculator.newCustomersRange);
    return midpoint === null ? UNKNOWN_QUANTITY : { value: midpoint, origin: "estimated" };
  }
  return UNKNOWN_QUANTITY;
}

// The cost per customer is only as firm as its weakest input (BR-dm-01, BR-dm-02, BR-dm-14).
function combineOrigins(spend: Quantity, newCustomers: Quantity): CostOrigin {
  if (spend.value === null || newCustomers.value === null || newCustomers.value === 0) {
    return "unknown";
  }
  return spend.origin === "measured" && newCustomers.origin === "measured"
    ? "measured"
    : "estimated";
}

function resolveCustomerProfit(calculator: CalculatorInput, rules: Rules): CustomerProfit | null {
  const average = calculator.averagePurchaseCents;
  const margin = calculator.marginPercent;
  const purchasesPerYear = lookupMidpoint(rules.midpoints.purchasesPerYear, calculator.purchasesPerYear);
  const years = lookupMidpoint(rules.midpoints.relationshipYears, calculator.relationshipLength);
  if (!isCents(average) || !isPercent(margin) || purchasesPerYear === null || years === null) {
    return null;
  }
  const yearlyProfit = (average * purchasesPerYear * margin) / PERCENT;
  return {
    lifetimeCents: roundHalfUp(yearlyProfit * years),
    monthlyExact: yearlyProfit / MONTHS_PER_YEAR,
  };
}

/**
 * Cost per customer (CAC), lifetime profit (LTV), their ratio and the payback
 * (RULE-dm-03, RULE-dm-12). Money is integer cents rounded half up; the ratio
 * and the payback stay exact because stages and risks use the exact values.
 *
 * Pure and total: bad or missing input becomes `null`, never an exception,
 * `NaN` or `Infinity` (IF-004, BR-dm-14, BR-dm-15).
 */
export function computeUnitEconomics(calculator: CalculatorInput, rules: Rules): UnitEconomics {
  const spend = resolveSpend(calculator, rules);
  const newCustomers = resolveNewCustomers(calculator, rules);
  const origin = combineOrigins(spend, newCustomers);
  const profit = resolveCustomerProfit(calculator, rules);

  const cacCents =
    origin === "unknown" ? null : roundHalfUp((spend.value as number) / (newCustomers.value as number));
  const ltvCents = profit === null ? null : profit.lifetimeCents;

  // A customer that costs nothing has no ratio to speak of: dividing by zero is not a number.
  const ratio =
    cacCents !== null && cacCents > 0 && ltvCents !== null ? roundExact(ltvCents / cacCents) : null;

  // BR-dm-15: with a known cost and no profit per month, the cost never comes back.
  const neverPaysBack =
    cacCents !== null && cacCents > 0 && profit !== null && profit.monthlyExact === 0;
  let paybackMonths: number | null = null;
  if (cacCents !== null && profit !== null && profit.monthlyExact > 0) {
    paybackMonths = roundExact(cacCents / profit.monthlyExact);
  }

  return {
    spendCents: spend.value,
    newCustomers: newCustomers.value,
    spendOrigin: spend.origin,
    newCustomersOrigin: newCustomers.origin,
    origin,
    cacCents,
    ltvCents,
    ratio,
    paybackMonths,
    neverPaysBack,
  };
}
