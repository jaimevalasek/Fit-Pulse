import { isValidIsoDate } from "../format/dates.ts";
import type { ActionKey } from "./types.ts";

/** The four states of an action (RULE-ra-04). Stored as text, so the stored value is the key. */
export const ACTION_STATUSES = ["todo", "in_progress", "done", "not_applicable"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

/** Who owns the action: a role, never a person's name (RULE-ra-04). */
export const ACTION_OWNER_ROLES = ["owner", "sales_team", "marketing_team", "consultant", "other"] as const;
export type ActionOwnerRole = (typeof ACTION_OWNER_ROLES)[number];

export const DEFAULT_ACTION_STATUS: ActionStatus = "todo";
export const ACTION_NOTE_MAX_LENGTH = 500;

/** The states in which a late deadline still counts as overdue (RULE-ra-06). */
const OPEN_STATUSES: ReadonlySet<ActionStatus> = new Set<ActionStatus>(["todo", "in_progress"]);

/** What the owner tracks about one action of the plan. */
export interface ActionProgressFields {
  status: ActionStatus;
  /** `YYYY-MM-DD`, the calendar date the owner chose. */
  dueDate: string | null;
  ownerRole: ActionOwnerRole | null;
  note: string | null;
}

/** The progress of one action of one diagnosis' plan. */
export interface ActionProgressEntry extends ActionProgressFields {
  actionKey: ActionKey;
}

/** The progress a new action row is born with, already carrying the inheritance (RULE-ra-05). */
export interface InheritedActionProgress extends ActionProgressEntry {
  /** The earlier diagnosis this action continues from; `null` for an action that starts now. */
  inheritedFromId: string | null;
}

/** The plan of the last completed, non-archived diagnosis and what was tracked on it. */
export interface PreviousPlanProgress {
  diagnosisId: string;
  /** The plan stored in that diagnosis' result. */
  plan: readonly ActionKey[];
  /** Rows tracked for it; an action of a version 1 diagnosis may have none. */
  progress: readonly ActionProgressEntry[];
}

export interface ActionInheritance {
  /** One entry per action of the new plan, in plan order. */
  actions: InheritedActionProgress[];
  /** Actions of the previous plan that do not repeat; they stay closed on the previous diagnosis. */
  closed: ActionKey[];
}

export function isActionStatus(value: unknown): value is ActionStatus {
  return typeof value === "string" && (ACTION_STATUSES as readonly string[]).includes(value);
}

export function isActionOwnerRole(value: unknown): value is ActionOwnerRole {
  return typeof value === "string" && (ACTION_OWNER_ROLES as readonly string[]).includes(value);
}

/** "A fazer", no deadline, no owner, no note: how a new action starts (RULE-ra-04). */
export function defaultActionProgress(): ActionProgressFields {
  return { status: DEFAULT_ACTION_STATUS, dueDate: null, ownerRole: null, note: null };
}

/**
 * Reads stored or received values into valid progress. An unknown state, role or date falls back to
 * the default instead of throwing, and a note is trimmed and cut to the limit.
 */
export function normalizeActionProgress(raw: {
  status?: unknown;
  dueDate?: unknown;
  ownerRole?: unknown;
  note?: unknown;
}): ActionProgressFields {
  const note = typeof raw.note === "string" ? raw.note.trim().slice(0, ACTION_NOTE_MAX_LENGTH) : "";
  return {
    status: isActionStatus(raw.status) ? raw.status : DEFAULT_ACTION_STATUS,
    dueDate: typeof raw.dueDate === "string" && isValidIsoDate(raw.dueDate) ? raw.dueDate : null,
    ownerRole: isActionOwnerRole(raw.ownerRole) ? raw.ownerRole : null,
    note: note === "" ? null : note,
  };
}

/**
 * Overdue (RULE-ra-06): a deadline before `today` on an action that is still "A fazer" or "Em andamento".
 * `today` is the computer's local calendar date as `YYYY-MM-DD`; both dates compare as text.
 * An action without a deadline, or any malformed date (including an invalid `today`, which `localIsoDate`
 * returns as `null`), is never overdue.
 */
export function isActionOverdue(
  progress: Pick<ActionProgressFields, "status" | "dueDate">,
  today: string | null,
): boolean {
  if (progress.dueDate === null || today === null || !isValidIsoDate(progress.dueDate) || !isValidIsoDate(today)) {
    return false;
  }
  return OPEN_STATUSES.has(progress.status) && progress.dueDate < today;
}

/**
 * The progress of a new diagnosis' plan (RULE-ra-05), compared by catalog key with the previous plan:
 * an action that repeats inherits status, deadline, owner and note; one that does not repeat is
 * reported as closed; a new one starts at the default. Each key appears once, in plan order.
 */
export function inheritActionProgress(
  plan: readonly ActionKey[],
  previous: PreviousPlanProgress | null,
): ActionInheritance {
  const newKeys = [...new Set(plan)];
  const previousKeys = previous === null ? [] : [...new Set(previous.plan)];
  const previousKeySet = new Set<ActionKey>(previousKeys);

  const trackedByKey = new Map<ActionKey, ActionProgressFields>();
  for (const entry of previous?.progress ?? []) {
    if (!trackedByKey.has(entry.actionKey)) trackedByKey.set(entry.actionKey, normalizeActionProgress(entry));
  }

  const actions = newKeys.map<InheritedActionProgress>((actionKey) => {
    if (previous === null || !previousKeySet.has(actionKey)) {
      return { actionKey, ...defaultActionProgress(), inheritedFromId: null };
    }
    return {
      actionKey,
      ...(trackedByKey.get(actionKey) ?? defaultActionProgress()),
      inheritedFromId: previous.diagnosisId,
    };
  });

  const newKeySet = new Set<ActionKey>(newKeys);
  return { actions, closed: previousKeys.filter((actionKey) => !newKeySet.has(actionKey)) };
}
