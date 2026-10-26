// Loads the preferences before the first screen, applies the theme to <html> and saves every change.
// A change shows at once; if the save fails the last saved value comes back and the caller gets the
// error to explain it.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getPreferences, updatePreferences } from "@/api/preferencesApi";
import type { Preferences, PreferencesUpdate, Theme } from "@/api/preferencesApi";
import { StatusView } from "@/components/feedback/StatusView";

interface PreferencesContextValue {
  preferences: Preferences;
  // Resolves with the saved preferences; rejects with the ApiError after restoring the saved value
  savePreferences: (update: PreferencesUpdate) => Promise<Preferences>;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready" };

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // Native controls (select lists, scrollbars) follow the chosen theme too
  root.style.colorScheme = theme;
}

function mergeUpdate(current: Preferences, update: PreferencesUpdate): Preferences {
  return {
    ...current,
    ...update,
    tourSeen: update.tourSeen ? { ...current.tourSeen, ...update.tourSeen } : current.tourSeen,
  };
}

function PreferencesProvider({ children }: { children: ReactNode }) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  // Last value the server confirmed, restored when a save fails
  const savedRef = useRef<Preferences | null>(null);
  // Only the newest save may write its answer, so quick successive changes do not flicker back
  const latestSaveRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({ status: "loading" });
    getPreferences(controller.signal)
      .then((loaded) => {
        savedRef.current = loaded;
        setPreferences(loaded);
        setLoadState({ status: "ready" });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load preferences", error);
        setLoadState({ status: "error" });
      });
    return () => controller.abort();
  }, [loadAttempt]);

  useLayoutEffect(() => {
    if (preferences) applyTheme(preferences.theme);
  }, [preferences]);

  const savePreferences = useCallback(async (update: PreferencesUpdate) => {
    const saveId = ++latestSaveRef.current;
    setPreferences((current) => (current ? mergeUpdate(current, update) : current));
    try {
      const saved = await updatePreferences(update);
      savedRef.current = saved;
      if (saveId === latestSaveRef.current) setPreferences(saved);
      return saved;
    } catch (error) {
      if (saveId === latestSaveRef.current) setPreferences(savedRef.current);
      throw error;
    }
  }, []);

  const value = useMemo(
    () => (preferences ? { preferences, savePreferences } : null),
    [preferences, savePreferences],
  );

  if (loadState.status === "ready" && value) {
    return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-[560px] content-center px-6 py-12 max-sm:px-4">
      {loadState.status === "error" ? (
        <StatusView
          state="error"
          title="Não foi possível abrir o FitPulse"
          description="As suas configurações não carregaram. Verifique se o app está aberto no Play e tente de novo."
          onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
          dataId="preferences-error"
        />
      ) : (
        <StatusView state="loading" title="Abrindo o FitPulse…" dataId="preferences-loading" />
      )}
    </main>
  );
}

function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside <PreferencesProvider>");
  return context;
}

export { PreferencesProvider, usePreferences };
export type { PreferencesContextValue };
