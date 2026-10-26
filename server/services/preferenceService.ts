import type { PrismaClient } from "../generated/prisma/client.ts";
import {
  createPreferenceRepository,
  type PreferenceChanges,
  type PreferenceRepository,
} from "../repositories/preferenceRepository.ts";
import {
  THEMES,
  USAGE_MODES,
  type PreferencesUpdate,
  type Theme,
  type UsageMode,
} from "../validation/preferenceSchemas.ts";
import {
  DEFAULT_REEVALUATION_DAYS,
  REEVALUATION_INTERVAL_OPTIONS,
  type ReevaluationIntervalDays,
} from "../../shared/domain/followUp.ts";
import { TOUR_SEEN_VERSION_MAX } from "../validation/preferenceSchemas.ts";
import { DomainError } from "./domainError.ts";

/** Shape of IF-008 and IF-009. Every field is always present, `null` or a default when nothing was saved. */
export interface PreferencesView {
  /** `null` until the first-run wizard records a choice. */
  usageMode: UsageMode | null;
  /** Only an active company; a focus that was archived or deleted since is reported as `null`. */
  focusCompanyId: string | null;
  theme: Theme;
  tourSeen: { owner: boolean; consultant: boolean };
  /** Days between diagnoses (RULE-ra-07): 60, 90, 120 or 180; 90 until the user chooses. */
  reevaluationIntervalDays: ReevaluationIntervalDays;
  /** Version of the presentation tour already seen; 0 until a tour of the current version is closed. */
  tourSeenVersion: number;
}

export interface PreferenceService {
  get(): Promise<PreferencesView>;
  /** Saves only the keys sent and answers with the whole preferences. */
  update(input: PreferencesUpdate): Promise<PreferencesView>;
}

export interface PreferenceServiceDeps {
  prisma: PrismaClient;
}

/** Keys of the `preferences` table. */
const KEY = {
  usageMode: "usage_mode",
  focusCompanyId: "focus_company_id",
  theme: "theme",
  tourSeenOwner: "tour_seen_owner",
  tourSeenConsultant: "tour_seen_consultant",
  reevaluationIntervalDays: "reevaluation_interval_days",
  tourSeenVersion: "tour_seen_version",
} as const;

// Only these keys are read: the table also holds the report brand, whose logo is large.
const OWN_KEYS: readonly string[] = Object.values(KEY);

/** Matches `:root` in tokens.css, where the dark "ink" theme is the one without `data-theme`. */
export const DEFAULT_THEME: Theme = "dark";

/** Nothing seen yet: every tour version is still to be shown. */
export const DEFAULT_TOUR_SEEN_VERSION = 0;

const STORED_TRUE = "true";
const STORED_FALSE = "false";

function focusCompanyNotFound(): DomainError {
  return new DomainError(
    404,
    "company_not_found",
    "Essa empresa não está mais na lista. Escolha outra empresa em foco.",
  );
}

// A value edited by hand or left by another version never reaches the screen: it reads as unset.
function readOneOf<T extends string>(allowed: readonly T[], stored: string | undefined): T | null {
  return allowed.find((option) => option === stored) ?? null;
}

// The interval is stored as text like the other values; anything but one of the four offered reads as the default.
function readReevaluationInterval(stored: string | undefined): ReevaluationIntervalDays {
  return REEVALUATION_INTERVAL_OPTIONS.find((option) => String(option) === stored) ?? DEFAULT_REEVALUATION_DAYS;
}

// A whole number inside the accepted range; a value edited by hand reads as "no tour seen".
function readTourSeenVersion(stored: string | undefined): number {
  if (stored === undefined || !/^\d+$/.test(stored)) {
    return DEFAULT_TOUR_SEEN_VERSION;
  }
  const version = Number(stored);
  return version <= TOUR_SEEN_VERSION_MAX ? version : DEFAULT_TOUR_SEEN_VERSION;
}

export function createPreferenceService({ prisma }: PreferenceServiceDeps): PreferenceService {
  const repository: PreferenceRepository = createPreferenceRepository(prisma);

  async function read(): Promise<PreferencesView> {
    const stored = await repository.readKeys(OWN_KEYS);
    const focusCompanyId = stored.get(KEY.focusCompanyId) ?? null;
    return {
      usageMode: readOneOf(USAGE_MODES, stored.get(KEY.usageMode)),
      // Resolved on read, not rewritten: restoring the archived company brings the focus back.
      focusCompanyId:
        focusCompanyId !== null && (await repository.activeCompanyExists(focusCompanyId)) ? focusCompanyId : null,
      theme: readOneOf(THEMES, stored.get(KEY.theme)) ?? DEFAULT_THEME,
      tourSeen: {
        owner: stored.get(KEY.tourSeenOwner) === STORED_TRUE,
        consultant: stored.get(KEY.tourSeenConsultant) === STORED_TRUE,
      },
      reevaluationIntervalDays: readReevaluationInterval(stored.get(KEY.reevaluationIntervalDays)),
      tourSeenVersion: readTourSeenVersion(stored.get(KEY.tourSeenVersion)),
    };
  }

  function toStoredFlag(seen: boolean): string {
    return seen ? STORED_TRUE : STORED_FALSE;
  }

  async function buildChanges(input: PreferencesUpdate): Promise<PreferenceChanges> {
    const changes: PreferenceChanges = { upserts: [], removals: [] };

    if (input.usageMode !== undefined) {
      changes.upserts.push({ key: KEY.usageMode, value: input.usageMode });
    }
    if (input.theme !== undefined) {
      changes.upserts.push({ key: KEY.theme, value: input.theme });
    }
    if (input.tourSeen?.owner !== undefined) {
      changes.upserts.push({ key: KEY.tourSeenOwner, value: toStoredFlag(input.tourSeen.owner) });
    }
    if (input.tourSeen?.consultant !== undefined) {
      changes.upserts.push({ key: KEY.tourSeenConsultant, value: toStoredFlag(input.tourSeen.consultant) });
    }
    if (input.reevaluationIntervalDays !== undefined) {
      changes.upserts.push({ key: KEY.reevaluationIntervalDays, value: String(input.reevaluationIntervalDays) });
    }
    if (input.tourSeenVersion !== undefined) {
      changes.upserts.push({ key: KEY.tourSeenVersion, value: String(input.tourSeenVersion) });
    }
    if (input.focusCompanyId === null) {
      changes.removals.push(KEY.focusCompanyId);
    } else if (input.focusCompanyId !== undefined) {
      if (!(await repository.activeCompanyExists(input.focusCompanyId))) {
        throw focusCompanyNotFound();
      }
      changes.upserts.push({ key: KEY.focusCompanyId, value: input.focusCompanyId });
    }

    return changes;
  }

  return {
    get: read,

    async update(input) {
      // Everything is checked before anything is written, so a refused focus saves nothing.
      await repository.applyChanges(await buildChanges(input));
      return read();
    },
  };
}
