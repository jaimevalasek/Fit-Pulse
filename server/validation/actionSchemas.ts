import { z } from "zod";
import {
  ACTION_NOTE_MAX_LENGTH,
  ACTION_OWNER_ROLES,
  ACTION_STATUSES,
} from "../../shared/domain/actionProgress.ts";
import { isValidIsoDate } from "../../shared/format/dates.ts";

const statusSchema = z.enum(ACTION_STATUSES, { error: "Escolha um dos estados da lista." });

// The deadline travels as the calendar date `YYYY-MM-DD`; the screen converts from `DD/MM/AAAA` (AC-ra-28).
const dueDateSchema = z
  .string({ error: "Informe a data no formato AAAA-MM-DD." })
  .refine((value) => isValidIsoDate(value), "Data inválida. Informe uma data real.");

// A role from the list, never a person's name (RULE-ra-04).
const ownerRoleSchema = z.enum(ACTION_OWNER_ROLES, { error: "Escolha um dos papéis da lista." });

// The limit counts what the owner typed; an empty or blank note clears the field.
const noteSchema = z
  .string({ error: "Escreva a nota como texto." })
  .max(ACTION_NOTE_MAX_LENGTH, `A nota aceita até ${ACTION_NOTE_MAX_LENGTH} caracteres.`)
  .transform((value) => (value.trim() === "" ? null : value.trim()));

/**
 * `PATCH /api/diagnoses/:id/actions/:actionKey` (IF-005): only the keys sent change and `null` clears a
 * deadline, an owner role or a note. Any other key (a person's name, the diagnosis, the result) is refused.
 */
export const actionPatchSchema = z.strictObject(
  {
    status: statusSchema.optional(),
    dueDate: dueDateSchema.nullable().optional(),
    ownerRole: ownerRoleSchema.nullable().optional(),
    note: noteSchema.nullable().optional(),
  },
  { error: "Envie o que mudou na ação." },
);

export type ActionPatch = z.infer<typeof actionPatchSchema>;
