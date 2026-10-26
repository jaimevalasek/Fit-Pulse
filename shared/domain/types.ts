/**
 * Shared domain types: answers, calculator input, rules and the frozen result.
 * Pure types plus a few key lists; no behavior lives here.
 */

export const DIMENSION_KEYS = ["mp", "pc", "cm", "mm", "aq", "en", "co", "re"] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];

export const QUESTION_IDS = [
  "mp1", "mp2", "mp3", "mp4",
  "pc1", "pc2", "pc3",
  "cm1", "cm2",
  "mm1", "mm2",
  "es1",
  "aq1", "aq2", "aq3",
  "en1", "en2", "en3",
  "co1", "co2", "co3",
  "re1", "re2", "re3",
] as const;
export type QuestionId = (typeof QUESTION_IDS)[number];

/** Dimension a question feeds. `structure` (es1) is not scored; it only gates stage 4. */
export type QuestionDimension = DimensionKey | "structure";

export type StageNumber = 1 | 2 | 3 | 4;

/** Blocks 1 to 8: block 1 is the calculator, blocks 2 to 8 hold the 24 questions. */
export type BlockNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type AnchorValue = 0 | 1 | 2 | 3;

/** `null` is "não sei" / "não acompanho" and counts as 0 in the score. */
export type AnswerValue = AnchorValue | null;

/** A missing key means the question is still unanswered. */
export type Answers = Partial<Record<QuestionId, AnswerValue>>;

export const SPEND_PART_KEYS = ["ads", "agency", "commission", "discount", "salary", "tools"] as const;
export type SpendPartKey = (typeof SPEND_PART_KEYS)[number];

export const SPEND_RANGE_KEYS = [
  "upTo1000",
  "from1000To5000",
  "from5000To15000",
  "from15000To50000",
  "over50000",
] as const;
export type SpendRangeKey = (typeof SPEND_RANGE_KEYS)[number];

export const NEW_CUSTOMERS_RANGE_KEYS = [
  "from1To10",
  "from11To30",
  "from31To100",
  "from101To300",
  "over300",
] as const;
export type NewCustomersRangeKey = (typeof NEW_CUSTOMERS_RANGE_KEYS)[number];

export const PURCHASES_PER_YEAR_KEYS = [
  "once",
  "twoToThree",
  "fourToSix",
  "sevenToTwelve",
  "overTwelve",
] as const;
export type PurchasesPerYearKey = (typeof PURCHASES_PER_YEAR_KEYS)[number];

export const RELATIONSHIP_LENGTH_KEYS = [
  "underSixMonths",
  "sixToTwelveMonths",
  "oneToTwoYears",
  "twoToFourYears",
  "overFourYears",
] as const;
export type RelationshipLengthKey = (typeof RELATIONSHIP_LENGTH_KEYS)[number];

/** How the owner filled the acquisition spend and the new-customers fields. */
export type EntryMode = "exact" | "range" | "unknown";

/**
 * Where a number the diary filled in came from (RULE-ra-09): `measured` is the sum of the
 * 3 most recent months, `estimated` is the 1 or 2 months projected to 3.
 */
export type DiaryOrigin = "measured" | "estimated";

export interface DiaryFieldSource {
  origin: DiaryOrigin;
  /** Oldest and newest diary month the number was built from, `YYYY-MM`. */
  fromMonth: string;
  toMonth: string;
  /** How many diary months it was built from: 3 when measured, 1 or 2 when estimated. */
  monthCount: number;
}

/** Which numbers of block 1 still carry the "do diário" mark; a number edited by hand loses it (AC-ra-46). */
export interface DiarySource {
  spend?: DiaryFieldSource;
  newCustomers?: DiaryFieldSource;
}

/**
 * The 1 or 2 diary months projected to 3 (average x 3, RULE-ra-09), frozen when the draft is
 * created and applied only when the owner asks for it ("Usar o diário").
 */
export interface DiarySuggestion {
  monthCount: number;
  fromMonth: string;
  toMonth: string;
  spendParts: Partial<Record<SpendPartKey, number>>;
  /** Set instead of `spendParts` when any of the months only has the total. */
  spendTotalCents: number | null;
  newCustomers: number;
}

/**
 * Block 1 ("Seus números"). Money is stored in integer cents (RULE-dm-12).
 * `null` / empty means the field was not filled yet.
 */
export interface CalculatorInput {
  spendMode: EntryMode | null;
  /** Cents per cost part; used when `spendMode` is `exact`. */
  spendParts: Partial<Record<SpendPartKey, number>>;
  /**
   * Single spend total in cents ("Só sei o total"), used when `spendMode` is `exact` and no part
   * is filled. Only the diary fills it; absent in the first version's inputs.
   */
  spendTotalCents?: number | null;
  /** Numbers that came from the diary and were not edited since; absent without a diary. */
  diarySource?: DiarySource;
  /** The 1 or 2 month projection the draft offers; `null` or absent when there is none. */
  diarySuggestion?: DiarySuggestion | null;
  spendRange: SpendRangeKey | null;
  newCustomersMode: EntryMode | null;
  /** Integer 0..1,000,000; 0 is accepted (BR-dm-14). Used when `newCustomersMode` is `exact`. */
  newCustomers: number | null;
  newCustomersRange: NewCustomersRangeKey | null;
  averagePurchaseCents: number | null;
  purchasesPerYear: PurchasesPerYearKey | null;
  relationshipLength: RelationshipLengthKey | null;
  /** Integer 0..100: how many reais are left out of each R$ 100 sold. */
  marginPercent: number | null;
}

export const EMPTY_CALCULATOR: Readonly<CalculatorInput> = Object.freeze({
  spendMode: null,
  spendParts: Object.freeze({}),
  spendRange: null,
  newCustomersMode: null,
  newCustomers: null,
  newCustomersRange: null,
  averagePurchaseCents: null,
  purchasesPerYear: null,
  relationshipLength: null,
  marginPercent: null,
});

/** Everything the engine needs: `evaluateDiagnosis(input, rules)`. */
export interface DiagnosisInput {
  answers: Answers;
  calculator: CalculatorInput;
}

/** Where the customer cost came from. `measured` needs both spend and new customers typed in. */
export type CostOrigin = "measured" | "estimated" | "unknown";

export interface UnitEconomics {
  spendCents: number | null;
  newCustomers: number | null;
  spendOrigin: CostOrigin;
  newCustomersOrigin: CostOrigin;
  /** `unknown` when the cost per customer cannot be calculated (BR-dm-01, BR-dm-14). */
  origin: CostOrigin;
  /** Cost to win one customer, rounded to the cent (half up). */
  cacCents: number | null;
  /** Lifetime profit of one customer, rounded to the cent. */
  ltvCents: number | null;
  /** Exact LTV:CAC ratio (display rounds to one decimal). */
  ratio: number | null;
  /** Exact payback in months (display rounds up). */
  paybackMonths: number | null;
  /** True when the cost is known but the margin is 0, so the cost never comes back (BR-dm-15). */
  neverPaysBack: boolean;
}

export type LockKey =
  | "cac"
  | "measure"
  | "mp"
  | "ratio"
  | "payback"
  | "pc"
  | "re"
  | "mm"
  | "co"
  | "es";

export type ActionKey = LockKey | "aq" | "en" | "dep" | "invest";

export type SignalId =
  | "SIG-01"
  | "SIG-02"
  | "SIG-03"
  | "SIG-04"
  | "SIG-05"
  | "SIG-06"
  | "SIG-07"
  | "SIG-08";

export type RiskLevel = "high" | "medium" | "low";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface DimensionResult {
  /** Integer 0..100 (RULE-dm-01, RULE-dm-02). */
  score: number;
  /** Stage this dimension would sustain on its own (RULE-dm-06). */
  supportsStage: StageNumber;
  /** True when the score is under the warning line ("Abaixo de 50"). */
  belowWarning: boolean;
}

export interface RiskResult {
  signalId: SignalId;
  probability: number;
  impact: number;
  /** probability × impact. */
  score: number;
  level: RiskLevel;
}

export interface ConfidenceResult {
  level: ConfidenceLevel;
  /** "Não sei" answers plus unknown calculator origins. */
  unknownCount: number;
  /** Items counted: 24 questions plus the two calculator origins. */
  totalItems: number;
}

/** The result frozen at completion (RULE-dm-11). */
export interface DiagnosisResult {
  rulesVersion: number;
  stage: StageNumber;
  /** First unmet criterion of the next stage; `null` at stage 4 (RULE-dm-05). */
  lock: LockKey | null;
  dimensions: Record<DimensionKey, DimensionResult>;
  /** Lowest score of the eight; ties follow the order of `DIMENSION_KEYS`. */
  weakestDimension: DimensionKey;
  unitEconomics: UnitEconomics;
  /** At most five, ordered by score then catalog order; may be empty (RULE-dm-07). */
  risks: RiskResult[];
  confidence: ConfidenceResult;
  /** Exactly three action keys, no repeats (RULE-dm-09). */
  plan: ActionKey[];
}

export interface RatioBandRules {
  /** Ratio below this is critical. */
  criticalBelow: number;
  /** Ratio below this (and not critical) is attention. */
  attentionBelow: number;
  /** Ratio up to and including this is healthy; above it the owner "can invest more". */
  healthyUpTo: number;
  /** Points of the ratio item inside "Canal e receita" (RULE-dm-02). */
  points: {
    critical: number;
    attention: number;
    healthy: number;
    aboveHealthy: number;
    /** When the ratio cannot be calculated. */
    unknown: number;
  };
}

export interface SignalWeight {
  probability: number;
  impact: number;
}

/**
 * One versioned bundle of thresholds and weights. A new rules version is a
 * new file that satisfies this type, never an edit of an old one.
 */
export interface Rules {
  version: number;
  ratio: RatioBandRules;
  /** Representative values for range answers ("ponto médio"). */
  midpoints: {
    spendCentsByRange: Record<SpendRangeKey, number>;
    newCustomersByRange: Record<NewCustomersRangeKey, number>;
    purchasesPerYear: Record<PurchasesPerYearKey, number>;
    relationshipYears: Record<RelationshipLengthKey, number>;
  };
  /** A dimension sustains stage 2, 3 or 4 from these scores (RULE-dm-06); below `stage2From` it sustains 1. */
  dimensionSupport: {
    stage2From: number;
    stage3From: number;
    stage4From: number;
    /** Scores under this show "Abaixo de N". */
    warnBelow: number;
  };
  /** Criteria of the next stage, checked in the order of RULE-dm-04. */
  stageGates: {
    stage2: { minMarketProduct: number };
    stage3: {
      minRatio: number;
      maxPaybackMonths: number;
      minProductChannel: number;
      minRetention: number;
    };
    stage4: { minRevenueMarket: number; minConversion: number; minStructureAnswer: AnchorValue };
  };
  risk: {
    maxRisks: number;
    /** Score at or above this is high. */
    highFrom: number;
    /** Score at or above this (and below `highFrom`) is medium; lower is low. */
    mediumFrom: number;
    /** SIG-05 fires when the retention score is below this. */
    retentionBelow: number;
    /** SIG-06 fires when the payback is above this many months. */
    paybackAboveMonths: number;
    signals: Record<SignalId, SignalWeight>;
  };
  confidence: {
    /** 24 questions plus the two calculator origins (spend and new customers). */
    totalItems: number;
    /** Unknown share up to this is high confidence. */
    highUpTo: number;
    /** Unknown share up to this is medium confidence; above is low. */
    mediumUpTo: number;
  };
  plan: {
    size: number;
    /** Tie-break between equally weak dimensions (RULE-dm-09); `cm` has no action of its own. */
    dimensionOrder: readonly DimensionKey[];
    invest: { minStage: StageNumber };
  };
}
