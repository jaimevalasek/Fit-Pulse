import { z } from "zod";
import { REEVALUATION_INTERVAL_OPTIONS } from "../../shared/domain/followUp.ts";

export const USAGE_MODES = ["owner", "consultant"] as const;
export const THEMES = ["dark", "light"] as const;

export type UsageMode = (typeof USAGE_MODES)[number];
export type Theme = (typeof THEMES)[number];

/**
 * Highest tour version the app accepts. The tour of part 2 is version 2; the cap only keeps an
 * absurd value from reaching the database.
 */
export const TOUR_SEEN_VERSION_MAX = 99;

/** Company ids are UUIDs; the cap only keeps an absurd value from reaching the database. */
const FOCUS_COMPANY_ID_MAX_LENGTH = 64;

const tourSeenSchema = z.object(
  {
    owner: z.boolean({ error: "Informe se o tour do modo empresa foi visto." }).optional(),
    consultant: z.boolean({ error: "Informe se o tour do modo consultoria foi visto." }).optional(),
  },
  { error: "Envie o tour visto de cada modo." },
);

/**
 * Body of `PUT /api/preferences` (IF-008, IF-009). Every key is optional and only the keys sent
 * change; `focusCompanyId: null` clears the company in focus. Unknown keys are dropped,
 * like in the company form.
 */
export const preferencesUpdateSchema = z.object(
  {
    usageMode: z.enum(USAGE_MODES, { error: "Escolha minha empresa ou consultoria." }).optional(),
    focusCompanyId: z
      .string({ error: "Escolha uma empresa da lista." })
      .trim()
      .min(1, "Escolha uma empresa da lista.")
      .max(FOCUS_COMPANY_ID_MAX_LENGTH, "Escolha uma empresa da lista.")
      .nullable()
      .optional(),
    theme: z.enum(THEMES, { error: "Escolha o tema escuro ou o claro." }).optional(),
    tourSeen: tourSeenSchema.optional(),
    // Days between diagnoses (RULE-ra-07): only the four offered in "Configurações".
    reevaluationIntervalDays: z
      .literal([...REEVALUATION_INTERVAL_OPTIONS], { error: "Escolha 60, 90, 120 ou 180 dias." })
      .optional(),
    // Version of the presentation tour already seen (0 = none); the tour of part 2 is version 2.
    tourSeenVersion: z
      .number({ error: "Informe a versão do tour visto." })
      .int("Informe a versão do tour visto.")
      .min(0, "Informe a versão do tour visto.")
      .max(TOUR_SEEN_VERSION_MAX, "Informe a versão do tour visto.")
      .optional(),
  },
  { error: "Envie as preferências." },
);

export type PreferencesUpdate = z.infer<typeof preferencesUpdateSchema>;
