// Calls of the preference routes (IF-008, IF-009). A PUT sends only the keys that change and answers with
// the whole saved preferences.
import { httpClient } from "./httpClient";

type UsageMode = "owner" | "consultant";
type Theme = "dark" | "light";
// Days between diagnoses; 90 until the user chooses another one
type ReevaluationIntervalDays = 60 | 90 | 120 | 180;

interface TourSeen {
  owner?: boolean;
  consultant?: boolean;
}

interface Preferences {
  // null until the first-run wizard records a choice
  usageMode: UsageMode | null;
  focusCompanyId?: string | null;
  theme: Theme;
  tourSeen: TourSeen;
  reevaluationIntervalDays: ReevaluationIntervalDays;
  // version of the presentation tour already seen; 0 until one is closed
  tourSeenVersion: number;
}

interface PreferencesUpdate {
  usageMode?: UsageMode;
  focusCompanyId?: string | null;
  theme?: Theme;
  tourSeen?: TourSeen;
  reevaluationIntervalDays?: ReevaluationIntervalDays;
  tourSeenVersion?: number;
}

const PREFERENCES_PATH = "/api/preferences";

function getPreferences(signal?: AbortSignal): Promise<Preferences> {
  return httpClient.get<Preferences>(PREFERENCES_PATH, { signal });
}

// 400 validation_failed for an unknown value (an interval outside 60, 90, 120 and 180 included); 404 company_not_found when the focus company does not
// exist or is archived
function updatePreferences(update: PreferencesUpdate): Promise<Preferences> {
  return httpClient.put<Preferences>(PREFERENCES_PATH, update);
}

export { getPreferences, updatePreferences };
export type { Preferences, PreferencesUpdate, ReevaluationIntervalDays, Theme, TourSeen, UsageMode };
