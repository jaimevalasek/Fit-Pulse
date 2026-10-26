import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { useLocation, useNavigate } from "react-router";
import { listCompanies } from "@/api/companiesApi";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/features/preferences/PreferencesProvider";

const HOME_PATH = "/inicio";
const HOLE_PADDING = 8;
const CARD_MAX_WIDTH = 360;
const CARD_HEIGHT_ESTIMATE = 220;
// The tour of version 2 (reports and follow-up); whoever saw only the version 1 tour sees it once more (AC-ra-37)
const TOUR_VERSION = 2;
// The home regions that mean "there is something to explain": an empty home opens no tour
const HOME_CONTENT_IDS = ["home-owner", "home-consultant"];

type StepPlace = "company-reports" | "settings" | "company-actions" | "company-diary" | null;

interface TourStep {
  // Region marked with data-aioson-tour; `fallbackIds` are data-aioson-ids tried after it
  anchor: string;
  fallbackIds: readonly string[];
  // Page the step opens; null keeps the current page (the mode switch lives in the top bar)
  place: StepPlace;
  title: string;
  text: string;
}

// The 5 steps of the prototype, the same in both usage modes: reports, brand, actions, diary and mode
const TOUR_STEPS: readonly TourStep[] = [
  {
    anchor: "relatorios",
    fallbackIds: ["report-preview", "tab-relatorios"],
    place: "company-reports",
    title: "Relatórios em PDF",
    text: 'Esta é a prévia do PDF, página por página: capa, resumo, gráfico das 8 dimensões e riscos. "Exportar PDF" salva na pasta Downloads e deixa abrir o arquivo na hora.',
  },
  {
    anchor: "marca",
    fallbackIds: ["brand-section"],
    place: "settings",
    title: "A sua marca no relatório",
    text: "Coloque nome, logo e contato de quem entrega. Eles saem na capa e no rodapé de todo PDF. Em branco, o PDF sai com a marca FitPulse.",
  },
  {
    anchor: "acoes",
    fallbackIds: ["actions-list", "actions-empty"],
    place: "company-actions",
    title: "Acompanhar as 3 ações",
    text: "Marque o andamento de cada ação, com prazo e responsável. O app mostra o que venceu e quantos dias faltam para refazer o diagnóstico.",
  },
  {
    anchor: "diario",
    fallbackIds: ["diary-empty"],
    place: "company-diary",
    title: "Diário de números",
    text: "Anote todo mês o gasto para atrair clientes e quantos clientes novos vieram. Com 3 meses, o custo por cliente vira um número medido no próximo diagnóstico.",
  },
  {
    anchor: "modo",
    fallbackIds: ["mode-toggle", "mode-chip", "nav"],
    place: null,
    title: "Modo consultoria",
    text: "Quem atende várias empresas troca o modo no topo ou em Configurações. Ganha o relatório da carteira e o questionário à distância, que o cliente responde no computador dele.",
  },
];

const COMPANY_TABS: Record<Exclude<StepPlace, "settings" | null>, string> = {
  "company-reports": "relatorios",
  "company-actions": "acoes",
  "company-diary": "diario",
};

// The page a step opens; the company pages need a company, otherwise the step stays where it is
function stepPath(step: TourStep, companyId: string | null): string | null {
  if (step.place === "settings") return "/configuracoes";
  if (!step.place || !companyId) return null;
  return `/empresa/${encodeURIComponent(companyId)}/${COMPANY_TABS[step.place]}`;
}

interface TourContextValue {
  // Opens the tour from its first step; each step opens its own page
  openTour: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

// A region hidden on this screen size (no box) does not count
function findVisible(selector: string): HTMLElement | null {
  const element = document.querySelector<HTMLElement>(selector);
  return element && element.getClientRects().length > 0 ? element : null;
}

function findAnchor(step: TourStep): HTMLElement | null {
  const selectors = [`[data-aioson-tour="${step.anchor}"]`, ...step.fallbackIds.map((id) => `[data-aioson-id="${id}"]`)];
  for (const selector of selectors) {
    const element = findVisible(selector);
    if (element) return element;
  }
  return null;
}

// Calls `onChange` whenever the page may have moved: content arriving, resize or scroll
function useLayoutChanges(onChange: () => void) {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(onChange);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [onChange]);
}

// Position of the highlighted region; null while it is not on the screen
function useAnchorRect(step: TourStep): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const scrolledRef = useRef<TourStep | null>(null);

  const measure = useCallback(() => {
    const target = findAnchor(step);
    if (target && scrolledRef.current !== step) {
      scrolledRef.current = step;
      target.scrollIntoView({ block: "center", behavior: "auto" });
    }
    setRect(target ? target.getBoundingClientRect() : null);
  }, [step]);

  useLayoutEffect(measure, [measure]);
  useLayoutChanges(measure);
  return rect;
}

function holeStyle(rect: DOMRect): CSSProperties {
  return {
    top: rect.top - HOLE_PADDING,
    left: rect.left - HOLE_PADDING,
    width: rect.width + HOLE_PADDING * 2,
    height: rect.height + HOLE_PADDING * 2,
    outline: "9999px solid var(--scrim)",
  };
}

// Below the region, or above it when there is no room; centered when the region is not shown
function cardStyle(rect: DOMRect | null): CSSProperties {
  if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  const cardWidth = Math.min(CARD_MAX_WIDTH, window.innerWidth - 32);
  const left = Math.min(Math.max(16, rect.left), window.innerWidth - cardWidth - 16);
  let top = rect.bottom + 16;
  if (top + CARD_HEIGHT_ESTIMATE > window.innerHeight) top = Math.max(16, rect.top - CARD_HEIGHT_ESTIMATE - 16);
  return { top, left };
}

function TourHighlight({ rect }: { rect: DOMRect | null }) {
  if (!rect) return <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] bg-scrim" />;
  return (
    <div
      aria-hidden="true"
      data-aioson-id="tour-highlight"
      className="pointer-events-none fixed z-[70] rounded-lg border-2 border-bronze transition-[top,left,width,height] duration-(--dur) ease-app motion-reduce:transition-none"
      style={holeStyle(rect)}
    />
  );
}

interface OnboardingTourProps {
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

function OnboardingTour({ index, onIndexChange, onClose }: OnboardingTourProps) {
  const steps = TOUR_STEPS;
  const step = steps[Math.min(index, steps.length - 1)];
  const rect = useAnchorRect(step);
  const titleId = useId();
  const textId = useId();
  const nextRef = useRef<HTMLButtonElement>(null);
  const isLast = index >= steps.length - 1;

  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <>
      <TourHighlight rect={rect} />
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={textId}
        data-aioson-id="tour-card"
        data-tour-step={step.anchor}
        className="fixed z-[71] w-[min(360px,calc(100%-32px))] rounded-lg border border-line-strong border-t-2 border-t-gold bg-solid p-6"
        style={cardStyle(rect)}
      >
        <p data-aioson-id="tour-count" className="font-mono text-xs tracking-[0.1em] text-bronze uppercase">
          {index + 1} de {steps.length}
        </p>
        <h2 id={titleId} className="my-2 text-2xl">
          {step.title}
        </h2>
        <p id={textId} className="text-sm text-text-soft">
          {step.text}
        </p>
        <TourControls
          nextRef={nextRef}
          canGoBack={index > 0}
          isLast={isLast}
          onBack={() => onIndexChange(index - 1)}
          onNext={() => (isLast ? onClose() : onIndexChange(index + 1))}
          onSkip={onClose}
        />
      </div>
    </>
  );
}

interface TourControlsProps {
  nextRef: RefObject<HTMLButtonElement | null>;
  canGoBack: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}

function TourControls({ nextRef, canGoBack, isLast, onBack, onNext, onSkip }: TourControlsProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" onClick={onSkip} data-aioson-id="tour-skip">
        Pular o tour
      </Button>
      <div className="flex gap-2">
        {canGoBack ? (
          <Button onClick={onBack} data-aioson-id="tour-prev">
            Voltar
          </Button>
        ) : null}
        <Button ref={nextRef} variant="metal" onClick={onNext} data-aioson-id="tour-next">
          {isLast ? "Entendi" : "Próximo"}
        </Button>
      </div>
    </div>
  );
}

// The company whose pages the tour opens: the saved focus, otherwise the first active company.
// Looked up only while the tour may open.
function useTourCompany(active: boolean, focusCompanyId: string | null | undefined) {
  const [found, setFound] = useState<{ ready: boolean; companyId: string | null }>({ ready: false, companyId: null });

  useEffect(() => {
    if (!active || focusCompanyId) return;
    const controller = new AbortController();
    listCompanies({}, controller.signal)
      .then((companies) => !controller.signal.aborted && setFound({ ready: true, companyId: companies[0]?.id ?? null }))
      .catch(() => !controller.signal.aborted && setFound({ ready: true, companyId: null }));
    return () => controller.abort();
  }, [active, focusCompanyId]);

  return focusCompanyId ? { ready: true, companyId: focusCompanyId } : found;
}

// The first time the home screen shows data after the tour changed, opens it once (AC-ra-37)
function useFirstVisitTour(enabled: boolean, open: () => void) {
  const triedRef = useRef(false);

  useEffect(() => {
    if (!enabled || triedRef.current) return;
    const tryOpen = () => {
      if (triedRef.current || !HOME_CONTENT_IDS.some((id) => findVisible(`[data-aioson-id="${id}"]`))) return;
      triedRef.current = true;
      open();
    };
    tryOpen();
    const observer = new MutationObserver(tryOpen);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled, open]);
}

// Opens the page of the current step; leaving that page by other means ends the tour
function useStepNavigation(index: number | null, companyId: string | null, onLeave: () => void) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const pathnameRef = useRef(pathname);
  const expectedPathRef = useRef<string | null>(null);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (index === null) {
      expectedPathRef.current = null;
      return;
    }
    const target = stepPath(TOUR_STEPS[index], companyId) ?? pathnameRef.current;
    expectedPathRef.current = target;
    if (target !== pathnameRef.current) navigate(target);
  }, [index, companyId, navigate]);

  useEffect(() => {
    if (expectedPathRef.current !== null && pathname !== expectedPathRef.current) onLeave();
  }, [pathname, onLeave]);
}

function TourProvider({ children }: { children: ReactNode }) {
  const { preferences, savePreferences } = usePreferences();
  const { pathname } = useLocation();
  // `requested` asks for the tour; it shows once the company of its pages is known
  const [requested, setRequested] = useState(false);
  const [index, setIndex] = useState(0);
  const mode = preferences.usageMode === "consultant" ? "consultant" : "owner";
  const seen = (preferences.tourSeenVersion ?? 0) >= TOUR_VERSION;
  const firstVisit = pathname === HOME_PATH && !seen && preferences.usageMode !== null;
  const company = useTourCompany(requested || firstVisit, preferences.focusCompanyId);
  const isOpen = requested && company.ready;

  const show = useCallback(() => {
    setIndex(0);
    setRequested(true);
  }, []);
  useFirstVisitTour(firstVisit && company.ready && company.companyId !== null, show);

  // Skipping, finishing or leaving the tour all count as seen
  const closeTour = useCallback(() => {
    setRequested(false);
    if (seen) return;
    savePreferences({ tourSeenVersion: TOUR_VERSION, tourSeen: { [mode]: true } }).catch((error: unknown) =>
      console.error("Failed to save tour", error),
    );
  }, [seen, mode, savePreferences]);

  useStepNavigation(isOpen ? index : null, company.companyId, closeTour);

  const value = useMemo(() => ({ openTour: show }), [show]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {isOpen ? <OnboardingTour index={index} onIndexChange={setIndex} onClose={closeTour} /> : null}
    </TourContext.Provider>
  );
}

function useTour(): TourContextValue {
  const context = useContext(TourContext);
  if (!context) throw new Error("useTour must be used inside <TourProvider>");
  return context;
}

export { OnboardingTour, TOUR_STEPS, TOUR_VERSION, TourProvider, useTour };
export type { TourStep };
