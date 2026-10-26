// Labels the owner reads for the stored keys of `shared/domain/actionProgress.ts`.

import { ACTION_OWNER_ROLES, ACTION_STATUSES } from "../domain/actionProgress.ts";
import type { ActionOwnerRole, ActionStatus } from "../domain/actionProgress.ts";

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  todo: "A fazer",
  in_progress: "Em andamento",
  done: "Feita",
  not_applicable: "Não se aplica",
};

export const ACTION_OWNER_ROLE_LABELS: Record<ActionOwnerRole, string> = {
  owner: "Dono",
  sales_team: "Equipe de vendas",
  marketing_team: "Equipe de marketing",
  consultant: "Consultor",
  other: "Outro",
};

export interface ActionProgressOption<Key extends string> {
  value: Key;
  label: string;
}

export const ACTION_STATUS_OPTIONS: readonly ActionProgressOption<ActionStatus>[] = ACTION_STATUSES.map((value) => ({
  value,
  label: ACTION_STATUS_LABELS[value],
}));

export const ACTION_OWNER_ROLE_OPTIONS: readonly ActionProgressOption<ActionOwnerRole>[] = ACTION_OWNER_ROLES.map(
  (value) => ({ value, label: ACTION_OWNER_ROLE_LABELS[value] }),
);
