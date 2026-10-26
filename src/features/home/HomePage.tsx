import { useEffect, useState } from "react";
import { getConsultantHome, getOwnerHome, type ConsultantHomeData, type OwnerHomeData } from "@/api/homeApi";
import { isApiError } from "@/api/httpClient";
import type { UsageMode } from "@/api/preferencesApi";
import { StatusView } from "@/components/feedback/StatusView";
import { usePreferences } from "@/features/preferences/PreferencesProvider";
import { ConsultantHome, NewCompanyButton } from "./ConsultantHome";
import { OwnerHome } from "./OwnerHome";

// Tagged by the mode that was asked for, not by the response body
type HomeData =
  | { kind: "owner"; data: OwnerHomeData }
  | { kind: "consultant"; data: ConsultantHomeData }
  | { kind: "owner-empty" };

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; data: HomeData };

// Owner mode: the server picks the saved focus company, then the first active one; its 404 means
// there is no company yet
async function loadOwnerHome(signal: AbortSignal): Promise<HomeData> {
  try {
    return { kind: "owner", data: await getOwnerHome(null, signal) };
  } catch (error) {
    if (isApiError(error) && error.status === 404) return { kind: "owner-empty" };
    throw error;
  }
}

// Reads the home again on every opening and when the focus company changes, so every number
// follows the current data (AC-dm-33)
function useHomeLoad(mode: UsageMode, focusCompanyId: string | null | undefined) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    const request: Promise<HomeData> =
      mode === "consultant"
        ? getConsultantHome(controller.signal).then((data) => ({ kind: "consultant" as const, data }))
        : loadOwnerHome(controller.signal);
    request
      .then((data) => {
        if (!controller.signal.aborted) setLoad({ status: "ready", data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [mode, focusCompanyId, attempt]);

  return { load, retry: () => setAttempt((value) => value + 1) };
}

// #/inicio: picks the screen by the usage mode chosen in the wizard or in Configurações
function HomePage() {
  const { preferences } = usePreferences();
  const mode: UsageMode = preferences.usageMode === "consultant" ? "consultant" : "owner";
  const { load, retry } = useHomeLoad(mode, preferences.focusCompanyId);

  if (load.status === "loading") return <StatusView state="loading" dataId="home-loading" title="Carregando a tela inicial…" />;
  if (load.status === "error") {
    return (
      <StatusView
        state="error"
        dataId="home-error"
        title="Não foi possível carregar a tela inicial"
        description="Os dados continuam salvos neste computador."
        onRetry={retry}
      />
    );
  }
  const home = load.data;
  if (home.kind === "consultant") return <ConsultantHome data={home.data} />;
  if (home.kind === "owner") return <OwnerHome data={home.data} />;
  return (
    <StatusView
      state="empty"
      dataId="home-owner-empty"
      title="Nenhuma empresa cadastrada"
      description="Cadastre a sua empresa para começar o primeiro diagnóstico."
      action={<NewCompanyButton label="Cadastrar a primeira empresa" dataId="home-first-company" />}
    />
  );
}

export { HomePage };
