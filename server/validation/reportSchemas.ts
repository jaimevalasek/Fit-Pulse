import { z } from "zod";

/** Report ids are UUIDs; the cap only keeps an absurd value from reaching the database. */
export const REPORT_ID_MAX_LENGTH = 64;

function idSchema(message: string) {
  return z.string({ error: message }).trim().min(1, message).max(REPORT_ID_MAX_LENGTH, message);
}

const diagnosisIdSchema = idSchema("Escolha um diagnóstico da lista.");

const diagnosisSelectionSchema = z.object({
  kind: z.literal("diagnosis"),
  diagnosisId: diagnosisIdSchema,
  // Off unless asked: the answers carry values in reais (BR-ra-08).
  includeAnswers: z.boolean({ error: "Informe se as respostas do questionário entram no relatório." }).default(false),
});

// "De" and "Até": the two diagnoses of one company the evolution compares (BR-ra-02). Whether they
// are completed, from the same company and in order is the business rule of the history service.
const evolutionSelectionSchema = z.object({
  kind: z.literal("evolution"),
  fromId: idSchema("Escolha o diagnóstico de onde a evolução parte."),
  toId: idSchema("Escolha o diagnóstico até onde a evolução vai."),
});

// The portfolio takes no option: it is every active company, as of today (CAP-ra-portfolio-report).
const portfolioSelectionSchema = z.object({
  kind: z.literal("portfolio"),
});

/**
 * What the owner picked in the report center (IF-001), one shape per type of report: the diagnosis,
 * the evolution and the portfolio. Unknown keys are dropped: nothing a screen sends, a path
 * included, ever reaches the service.
 */
export const reportSelectionSchema = z.discriminatedUnion(
  "kind",
  [diagnosisSelectionSchema, evolutionSelectionSchema, portfolioSelectionSchema],
  { error: "Escolha o tipo do relatório." },
);

export type ReportSelection = z.infer<typeof reportSelectionSchema>;

// A query string carries text only: "true" and "false" become the booleans the schema reads.
// Any other text stays as it is and fails the check.
function readQueryFlags(query: unknown): unknown {
  if (typeof query !== "object" || query === null || Array.isArray(query)) {
    return query;
  }
  const { includeAnswers } = query as { includeAnswers?: unknown };
  if (includeAnswers !== "true" && includeAnswers !== "false") {
    return query;
  }
  return { ...query, includeAnswers: includeAnswers === "true" };
}

/** `GET /api/reports/preview`: the same selection as the body of the export, written as a query string. */
export const reportSelectionQuerySchema = z.preprocess(readQueryFlags, reportSelectionSchema);
