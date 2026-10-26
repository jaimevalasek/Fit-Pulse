// #/configuracoes: the brand on the reports (CAP-ra-brand), the reevaluation interval (CAP-ra-home-followup), usage mode, focus company and theme (saved on every change), the backup copy,
// how to read the results, what the Play assistant can read (RULE-dm-17) and the security note (OQ-6).
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { listCompanies } from "@/api/companiesApi";
import type { Company } from "@/api/companiesApi";
import { isApiError } from "@/api/httpClient";
import type { PreferencesUpdate, UsageMode } from "@/api/preferencesApi";
import { Label } from "@/components/ui/label";
import { usePreferences } from "@/features/preferences/PreferencesProvider";
import { BackupSection } from "@/features/settings/BackupSection";
import { BrandSection } from "@/features/settings/BrandSection";
import { ReevaluationSection } from "@/features/settings/ReevaluationSection";
import { cn } from "@/lib/utils";
import { RULES_VERSION } from "../../../shared/rules/rulesV1";

type SettingKey = "mode" | "focus" | "theme";
type Feedback = { key: SettingKey; kind: "saved" | "error"; message: string } | null;
type CompaniesState = { status: "loading" } | { status: "error" } | { status: "ready"; companies: Company[] };

const SELECT_CLASS = cn(
  "h-(--control) w-full min-w-0 rounded-md border border-line-strong bg-ground-sunken px-3 text-base text-text",
  "hover:border-text-soft focus:border-bronze max-sm:h-(--touch)",
);

const SAVED_MESSAGE = "Salvo neste computador.";
const CHOICE_GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2";

function saveErrorMessage(error: unknown): string {
  if (isApiError(error) && error.code === "company_not_found") {
    return "Essa empresa foi arquivada ou não existe mais. Escolha outra.";
  }
  if (isApiError(error) && error.code === "network_error") return error.message;
  return "Não foi possível salvar a escolha. Tente de novo.";
}

function SettingsSection({ title, description, dataId, children }: {
  title: string;
  description: string;
  dataId?: string;
  children: ReactNode;
}) {
  return (
    <section
      data-aioson-id={dataId}
      className="grid grid-cols-[260px_minmax(0,1fr)] gap-8 border-b border-line py-8 max-md:grid-cols-1 max-md:gap-4"
    >
      <div>
        <h2>{title}</h2>
        <p className="mt-1 text-sm text-text-soft">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function ChoiceCard({ name, value, checked, title, hint, onSelect }: {
  name: string;
  value: string;
  checked: boolean;
  title: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-(--touch) cursor-pointer items-start gap-3 rounded-md border border-line-strong px-4 py-3",
        "transition-colors duration-(--fast) ease-app hover:border-text-soft has-checked:border-bronze has-checked:bg-wash",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-1 size-4 shrink-0 accent-(--bronze)"
      />
      <span>
        <b className="block text-sm font-semibold">{title}</b>
        <span className="text-sm text-text-soft">{hint}</span>
      </span>
    </label>
  );
}

function FeedbackLine({ feedback, settingKey }: { feedback: Feedback; settingKey: SettingKey }) {
  const current = feedback?.key === settingKey ? feedback : null;
  return (
    <>
      <p role="status" className="mt-2 min-h-[1.25em] text-sm text-ok">
        {current?.kind === "saved" ? current.message : ""}
      </p>
      {current?.kind === "error" ? (
        <p role="alert" className="text-sm text-danger" data-state="error">
          {current.message}
        </p>
      ) : null}
    </>
  );
}

function FocusCompanyField({ focusCompanyId, companiesState, onSelect, onRetry }: {
  focusCompanyId: string | null;
  companiesState: CompaniesState;
  onSelect: (companyId: string) => void;
  onRetry: () => void;
}) {
  if (companiesState.status === "loading") {
    return <p className="text-sm text-text-soft" role="status">Carregando as empresas…</p>;
  }
  if (companiesState.status === "error") {
    return (
      <p role="alert" className="text-sm text-danger">
        Não foi possível carregar as empresas.{" "}
        <button type="button" onClick={onRetry} className="inline-flex min-h-(--touch) items-center underline">
          Tentar de novo
        </button>
      </p>
    );
  }
  const { companies } = companiesState;
  if (companies.length === 0) {
    return <p className="text-sm text-text-soft">Cadastre uma empresa em Empresas para escolher a empresa em foco.</p>;
  }
  const hasFocus = companies.some((company) => company.id === focusCompanyId);
  return (
    <div className="flex max-w-[360px] flex-col gap-1">
      <Label htmlFor="settings-focus-company">Empresa em foco</Label>
      <select
        id="settings-focus-company"
        data-aioson-id="settings-focus-company"
        className={SELECT_CLASS}
        value={hasFocus && focusCompanyId ? focusCompanyId : ""}
        onChange={(event) => {
          if (event.target.value) onSelect(event.target.value);
        }}
      >
        {hasFocus ? null : <option value="">Escolha uma empresa</option>}
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// Active companies for the focus company list; `reload` refreshes it after a refused choice
function useActiveCompanies() {
  const [state, setState] = useState<CompaniesState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    listCompanies({}, controller.signal)
      .then((companies) => setState({ status: "ready", companies }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);
  return { companiesState: state, reloadCompanies: reload };
}

type SaveSetting = (key: SettingKey, update: PreferencesUpdate) => void;

function UsageModeSection({ feedback, save }: { feedback: Feedback; save: SaveSetting }) {
  const { preferences } = usePreferences();
  const { companiesState, reloadCompanies } = useActiveCompanies();
  const usageMode: UsageMode = preferences.usageMode ?? "owner";
  const focusCompanyId = preferences.focusCompanyId ?? null;

  useEffect(() => {
    if (feedback?.kind === "error" && feedback.key === "focus") reloadCompanies();
  }, [feedback, reloadCompanies]);

  const selectMode = (mode: UsageMode) => {
    const update: PreferencesUpdate = { usageMode: mode };
    // With a single company there is nothing to choose: it becomes the focus company
    if (mode === "owner" && !focusCompanyId && companiesState.status === "ready" && companiesState.companies.length === 1) {
      update.focusCompanyId = companiesState.companies[0].id;
    }
    save("mode", update);
  };

  return (
    <SettingsSection
      title="Como você usa o app"
      description="Muda a tela inicial e o menu. Os dados não mudam."
      dataId="settings-mode"
    >
      <div role="radiogroup" aria-label="Modo de uso" className={CHOICE_GRID_CLASS}>
        <ChoiceCard
          name="usage-mode"
          value="owner"
          checked={usageMode === "owner"}
          title="Minha empresa"
          hint="Uma empresa em foco, com o lembrete e as ações na tela inicial."
          onSelect={() => selectMode("owner")}
        />
        <ChoiceCard
          name="usage-mode"
          value="consultant"
          checked={usageMode === "consultant"}
          title="Consultoria"
          hint="Várias empresas, com a carteira por estágio e o relatório da carteira."
          onSelect={() => selectMode("consultant")}
        />
      </div>
      <FeedbackLine feedback={feedback} settingKey="mode" />
      {usageMode === "owner" ? (
        <div className="mt-2">
          <FocusCompanyField
            focusCompanyId={focusCompanyId}
            companiesState={companiesState}
            onSelect={(companyId) => save("focus", { focusCompanyId: companyId })}
            onRetry={reloadCompanies}
          />
          <FeedbackLine feedback={feedback} settingKey="focus" />
        </div>
      ) : null}
    </SettingsSection>
  );
}

function ThemeSection({ feedback, save }: { feedback: Feedback; save: SaveSetting }) {
  const { preferences } = usePreferences();
  const isLight = preferences.theme === "light";
  return (
    <SettingsSection
      title="Aparência"
      description="O tema escuro acompanha o AIOSON Play. O claro é melhor sob muita luz."
      dataId="settings-theme"
    >
      <div role="radiogroup" aria-label="Tema" className={CHOICE_GRID_CLASS}>
        <ChoiceCard
          name="theme"
          value="dark"
          checked={!isLight}
          title="Escuro"
          hint="Padrão, igual ao AIOSON Play."
          onSelect={() => save("theme", { theme: "dark" })}
        />
        <ChoiceCard
          name="theme"
          value="light"
          checked={isLight}
          title="Claro"
          hint="Fundo claro, bom sob muita luz."
          onSelect={() => save("theme", { theme: "light" })}
        />
      </div>
      <FeedbackLine feedback={feedback} settingKey="theme" />
    </SettingsSection>
  );
}

function ResultsGuideSection() {
  return (
    <SettingsSection title="Como ler os resultados" description="O que o diagnóstico diz e o que não diz." dataId="settings-results">
      <div className="grid gap-2 text-sm text-text-soft">
        <p>
          O diagnóstico é uma orientação baseada nas suas respostas e não substitui uma análise financeira. Quanto mais
          números medidos você informar, maior a confiança do resultado.
        </p>
        <p>
          Cada diagnóstico guarda a versão do cálculo usada nele. Os diagnósticos novos usam a versão {RULES_VERSION}. Uma
          atualização do app nunca muda a nota de um diagnóstico antigo.
        </p>
      </div>
    </SettingsSection>
  );
}

// Exactly what GET /api/aioson-play exposes (RULE-dm-17)
function AssistantSection() {
  return (
    <SettingsSection
      title="O que o assistente do Play pode ler"
      description="O que o assistente de IA do AIOSON Play consegue ver deste app."
      dataId="settings-assistant"
    >
      <ul className="list-disc pl-4 text-sm text-text-soft" data-aioson-id="settings-assistant-fields">
        <li>Se o app está funcionando.</li>
        <li>De cada empresa ativa: o nome, o estágio, a dimensão que mais trava e a data do último diagnóstico.</li>
      </ul>
      <p className="mt-2 text-sm text-text-soft">
        O assistente não vê valores em reais nem as suas respostas, e não cria nem altera diagnósticos.
      </p>
    </SettingsSection>
  );
}

function SecuritySection() {
  return (
    <SettingsSection title="Segurança" description="Quem consegue abrir os seus dados." dataId="settings-security">
      <p className="text-sm text-text-soft">
        O acesso ao FitPulse é protegido pelo login do AIOSON Play: o app não tem login próprio. Os dados ficam só neste
        computador e o app não recebe conexões de outros computadores da rede.
      </p>
    </SettingsSection>
  );
}

function SettingsPage() {
  const { savePreferences } = usePreferences();
  const [feedback, setFeedback] = useState<Feedback>(null);

  const save = useCallback<SaveSetting>(
    (key, update) => {
      setFeedback(null);
      savePreferences(update).then(
        () => setFeedback({ key, kind: "saved", message: SAVED_MESSAGE }),
        (error: unknown) => setFeedback({ key, kind: "error", message: saveErrorMessage(error) }),
      );
    },
    [savePreferences],
  );

  return (
    <article aria-labelledby="settings-title" data-aioson-id="settings">
      <header className="mb-2">
        <h1 id="settings-title">Configurações</h1>
        <p className="mt-2 text-sm text-text-soft">Tudo fica salvo só neste computador.</p>
      </header>
      <SettingsSection
        title="Seus relatórios"
        description="Nome, logo e contato de quem entrega. Saem na capa e no rodapé de todo PDF. Em branco, o PDF sai com a marca FitPulse."
        dataId="brand-section"
      >
        <BrandSection />
      </SettingsSection>
      <SettingsSection
        title="Lembrete de reavaliação"
        description="A tela inicial avisa quando chega a hora de refazer o diagnóstico. O aviso aparece só aqui no app."
        dataId="settings-reevaluation"
      >
        <ReevaluationSection />
      </SettingsSection>
      <UsageModeSection feedback={feedback} save={save} />
      <ThemeSection feedback={feedback} save={save} />
      <SettingsSection
        title="Cópia de segurança"
        description="Guarde uma cópia antes de trocar de computador. A atualização do app pela loja mantém os seus dados."
        dataId="settings-backup"
      >
        <BackupSection />
      </SettingsSection>
      <ResultsGuideSection />
      <AssistantSection />
      <SecuritySection />
    </article>
  );
}

export { SettingsPage };
