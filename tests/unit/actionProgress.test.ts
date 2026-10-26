import { describe, expect, it } from "vitest";
import { ACTION_OWNER_ROLE_LABELS, ACTION_STATUS_LABELS } from "../../shared/content/actionProgressOptions.ts";
import {
  ACTION_NOTE_MAX_LENGTH,
  ACTION_OWNER_ROLES,
  ACTION_STATUSES,
  defaultActionProgress,
  inheritActionProgress,
  isActionOverdue,
  normalizeActionProgress,
} from "../../shared/domain/actionProgress.ts";
import type { ActionProgressEntry, PreviousPlanProgress } from "../../shared/domain/actionProgress.ts";
import type { ActionKey } from "../../shared/domain/types.ts";

const PREVIOUS_ID = "diagnosis-previous";

function tracked(actionKey: ActionKey, overrides: Partial<ActionProgressEntry> = {}): ActionProgressEntry {
  return { actionKey, ...defaultActionProgress(), ...overrides };
}

function previousPlan(plan: ActionKey[], progress: ActionProgressEntry[]): PreviousPlanProgress {
  return { diagnosisId: PREVIOUS_ID, plan, progress };
}

describe("options", () => {
  it("labels the four states and the five roles for the owner (RULE-ra-04)", () => {
    expect(ACTION_STATUSES.map((status) => ACTION_STATUS_LABELS[status])).toEqual([
      "A fazer",
      "Em andamento",
      "Feita",
      "Não se aplica",
    ]);
    expect(ACTION_OWNER_ROLES.map((role) => ACTION_OWNER_ROLE_LABELS[role])).toEqual([
      "Dono",
      "Equipe de vendas",
      "Equipe de marketing",
      "Consultor",
      "Outro",
    ]);
  });
});

describe("a new action (RULE-ra-04)", () => {
  it("starts as A fazer, without deadline, owner or note", () => {
    expect(defaultActionProgress()).toEqual({ status: "todo", dueDate: null, ownerRole: null, note: null });
  });

  it("reads unknown stored values as the default instead of throwing", () => {
    expect(normalizeActionProgress({ status: "abandoned", dueDate: "31/12/2026", ownerRole: "Joao", note: 42 })).toEqual(
      defaultActionProgress(),
    );
    expect(normalizeActionProgress({})).toEqual(defaultActionProgress());
    expect(normalizeActionProgress({ dueDate: "2026-02-31" }).dueDate).toBeNull();
  });

  it("keeps valid values, trims the note and cuts it to 500 characters", () => {
    const long = "x".repeat(ACTION_NOTE_MAX_LENGTH + 20);
    expect(
      normalizeActionProgress({ status: "done", dueDate: "2026-11-30", ownerRole: "consultant", note: `  ${long}  ` }),
    ).toEqual({ status: "done", dueDate: "2026-11-30", ownerRole: "consultant", note: "x".repeat(ACTION_NOTE_MAX_LENGTH) });
    expect(normalizeActionProgress({ note: "   " }).note).toBeNull();
  });
});

// RULE-ra-06
describe("overdue action", () => {
  const today = "2026-10-25";

  it("is overdue when the deadline is before today and the action is A fazer or Em andamento", () => {
    expect(isActionOverdue({ status: "todo", dueDate: "2026-10-24" }, today)).toBe(true);
    expect(isActionOverdue({ status: "in_progress", dueDate: "2026-01-01" }, today)).toBe(true);
  });

  it("is not overdue on the deadline day or before it", () => {
    expect(isActionOverdue({ status: "todo", dueDate: "2026-10-25" }, today)).toBe(false);
    expect(isActionOverdue({ status: "todo", dueDate: "2026-10-26" }, today)).toBe(false);
  });

  it("is not overdue once it is Feita or Não se aplica, whatever the deadline", () => {
    expect(isActionOverdue({ status: "done", dueDate: "2026-01-01" }, today)).toBe(false);
    expect(isActionOverdue({ status: "not_applicable", dueDate: "2026-01-01" }, today)).toBe(false);
  });

  it("is not overdue without a deadline or with a malformed date", () => {
    expect(isActionOverdue({ status: "todo", dueDate: null }, today)).toBe(false);
    expect(isActionOverdue({ status: "todo", dueDate: "2026-02-31" }, today)).toBe(false);
    expect(isActionOverdue({ status: "todo", dueDate: "2026-10-24" }, "")).toBe(false);
    expect(isActionOverdue({ status: "todo", dueDate: "2026-10-24" }, "25/10/2026")).toBe(false);
  });
});

// AC-ra-31, RULE-ra-05
describe("inheritActionProgress", () => {
  it("gives every action the default and no origin when there is no previous diagnosis", () => {
    const { actions, closed } = inheritActionProgress(["mp", "pc", "aq"], null);
    expect(actions).toEqual([
      { actionKey: "mp", ...defaultActionProgress(), inheritedFromId: null },
      { actionKey: "pc", ...defaultActionProgress(), inheritedFromId: null },
      { actionKey: "aq", ...defaultActionProgress(), inheritedFromId: null },
    ]);
    expect(closed).toEqual([]);
  });

  it("carries status, deadline, owner and note of an action that repeats, and points to the previous diagnosis", () => {
    const previous = previousPlan(
      ["mp", "pc", "aq"],
      [
        tracked("mp", { status: "in_progress", dueDate: "2026-11-10", ownerRole: "sales_team", note: "Falar com 10 clientes" }),
        tracked("pc", { status: "done" }),
      ],
    );
    const { actions } = inheritActionProgress(["mp", "en", "co"], previous);

    expect(actions[0]).toEqual({
      actionKey: "mp",
      status: "in_progress",
      dueDate: "2026-11-10",
      ownerRole: "sales_team",
      note: "Falar com 10 clientes",
      inheritedFromId: PREVIOUS_ID,
    });
  });

  it("starts the new actions as A fazer, with no origin", () => {
    const previous = previousPlan(["mp", "pc", "aq"], [tracked("mp", { status: "done" })]);
    const { actions } = inheritActionProgress(["mp", "en", "co"], previous);

    expect(actions[1]).toEqual({ actionKey: "en", ...defaultActionProgress(), inheritedFromId: null });
    expect(actions[2]).toEqual({ actionKey: "co", ...defaultActionProgress(), inheritedFromId: null });
  });

  it("closes the previous actions that do not repeat, keeping their order", () => {
    const previous = previousPlan(["mp", "pc", "aq"], [tracked("pc", { status: "done" })]);
    const { closed } = inheritActionProgress(["mp", "en", "co"], previous);

    expect(closed).toEqual(["pc", "aq"]);
  });

  it("answers the repeated, new and closed case of the acceptance criterion in one plan", () => {
    const previous = previousPlan(
      ["mp", "pc", "aq"],
      [tracked("mp", { status: "done", note: "Feito" }), tracked("pc", { status: "in_progress" })],
    );
    const result = inheritActionProgress(["aq", "mp", "dep"], previous);

    expect(result.actions.map(({ actionKey, status, inheritedFromId }) => ({ actionKey, status, inheritedFromId }))).toEqual([
      { actionKey: "aq", status: "todo", inheritedFromId: PREVIOUS_ID },
      { actionKey: "mp", status: "done", inheritedFromId: PREVIOUS_ID },
      { actionKey: "dep", status: "todo", inheritedFromId: null },
    ]);
    expect(result.closed).toEqual(["pc"]);
  });

  it("treats a repeated action of a version 1 diagnosis, with no stored row, as A fazer that still continues", () => {
    const previous = previousPlan(["mp", "pc", "aq"], []);
    const { actions } = inheritActionProgress(["pc", "en", "co"], previous);

    expect(actions[0]).toEqual({ actionKey: "pc", ...defaultActionProgress(), inheritedFromId: PREVIOUS_ID });
  });

  it("never lists a key twice, whether the plans or the stored rows repeat it", () => {
    const previous = previousPlan(
      ["mp", "mp", "pc"],
      [tracked("mp", { status: "done" }), tracked("mp", { status: "in_progress" })],
    );
    const { actions, closed } = inheritActionProgress(["mp", "mp", "en"], previous);

    expect(actions.map((action) => action.actionKey)).toEqual(["mp", "en"]);
    expect(actions[0]?.status).toBe("done");
    expect(closed).toEqual(["pc"]);
  });

  it("does not trust corrupt stored rows: an unknown state inherits as A fazer", () => {
    const corrupt = { actionKey: "mp", status: "weird", dueDate: "tomorrow", ownerRole: "boss", note: "ok" } as unknown as ActionProgressEntry;
    const { actions } = inheritActionProgress(["mp"], previousPlan(["mp"], [corrupt]));

    expect(actions[0]).toEqual({ actionKey: "mp", status: "todo", dueDate: null, ownerRole: null, note: "ok", inheritedFromId: PREVIOUS_ID });
  });

  it("does not change what it was given", () => {
    const row = tracked("mp", { status: "done" });
    const previous = previousPlan(["mp", "pc", "aq"], [row]);
    const plan: ActionKey[] = ["mp", "en", "co"];
    inheritActionProgress(plan, previous);

    expect(plan).toEqual(["mp", "en", "co"]);
    expect(previous.plan).toEqual(["mp", "pc", "aq"]);
    expect(row.status).toBe("done");
  });
});
