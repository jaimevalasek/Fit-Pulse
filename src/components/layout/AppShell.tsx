import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router";
import type { Preferences } from "@/api/preferencesApi";
import { Button } from "@/components/ui/button";
import { useTour } from "@/features/home/OnboardingTour";
import { usePreferences } from "@/features/preferences/PreferencesProvider";
import { cn } from "@/lib/utils";

const MAIN_CONTENT_ID = "conteudo";
// The first-run wizard shows only the brand and the theme: there is nothing to navigate to yet
const WIZARD_PATH = "/boas-vindas";

interface NavItem {
  to: string;
  label: string;
  dataId: string;
  // Path prefixes that mark the item as the current page
  matches: readonly string[];
}

// The menu follows the usage mode (BR-dm-09): the consultancy reaches every company, the owner goes
// straight to the focus company. Without a focus company the owner still reaches the list.
function buildNavItems({ usageMode, focusCompanyId }: Preferences): NavItem[] {
  const companiesItem: NavItem =
    usageMode === "owner" && focusCompanyId
      ? {
          to: `/empresa/${encodeURIComponent(focusCompanyId)}`,
          label: "Minha empresa",
          dataId: "nav-minha-empresa",
          matches: ["/empresa", "/empresas"],
        }
      : { to: "/empresas", label: "Empresas", dataId: "nav-empresas", matches: ["/empresas", "/empresa"] };
  return [
    { to: "/inicio", label: "Início", dataId: "nav-inicio", matches: ["/inicio"] },
    companiesItem,
    { to: "/configuracoes", label: "Configurações", dataId: "nav-configuracoes", matches: ["/configuracoes"] },
  ];
}

function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const MODE_LABELS: Record<NonNullable<Preferences["usageMode"]>, string> = {
  owner: "Modo minha empresa",
  consultant: "Modo consultoria",
};

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-[34px] place-items-center rounded-md border border-line-strong bg-surface text-bronze"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
        <rect x="2" y="16" width="4.5" height="5" rx="1" opacity=".55" />
        <rect x="7.2" y="12" width="4.5" height="9" rx="1" opacity=".7" />
        <rect x="12.4" y="8" width="4.5" height="13" rx="1" />
        <rect x="17.6" y="4" width="4.5" height="17" rx="1" opacity=".35" />
      </svg>
    </span>
  );
}

function navLinkClassName(isActive: boolean) {
  return cn(
    "relative inline-flex min-h-(--control) items-center rounded-md px-3 text-sm font-medium no-underline",
    "text-text-soft transition-colors duration-(--fast) ease-app hover:text-text max-sm:min-h-(--touch)",
    isActive &&
      "text-text after:absolute after:inset-x-3 after:bottom-0.5 after:h-0.5 after:rounded-sm after:bg-bronze after:content-['']",
  );
}

function ThemeIcon({ theme }: { theme: Preferences["theme"] }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      {theme === "light" ? (
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      )}
    </svg>
  );
}

function ThemeToggle() {
  const { preferences, savePreferences } = usePreferences();
  const nextTheme = preferences.theme === "light" ? "dark" : "light";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Alternar entre tema escuro e claro"
      title="Tema"
      data-aioson-id="theme-toggle"
      onClick={() => {
        // A failed save restores the saved theme in the provider; Configurações explains the error
        savePreferences({ theme: nextTheme }).catch((error: unknown) => console.error("Failed to save theme", error));
      }}
    >
      <ThemeIcon theme={preferences.theme} />
    </Button>
  );
}

function TourButton() {
  const { openTour } = useTour();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Abrir o tour de apresentação"
      title="Como usar"
      data-aioson-id="tour-reopen"
      onClick={openTour}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M9.6 9.2a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.6" />
        <path d="M12 17h.01" />
      </svg>
    </Button>
  );
}

function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={(event) => {
        // Hash routing owns the URL fragment, so move focus without navigating.
        event.preventDefault();
        document.getElementById(MAIN_CONTENT_ID)?.focus();
      }}
      className={cn(
        "sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50",
        "focus:inline-flex focus:min-h-(--touch) focus:items-center focus:rounded-md focus:border",
        "focus:border-gold focus:bg-surface focus:px-4 focus:text-sm focus:font-semibold focus:text-text",
      )}
    >
      Pular para o conteúdo
    </a>
  );
}

function Brand() {
  return (
    <NavLink to="/" data-aioson-id="brand" className="flex items-center gap-3 text-text no-underline max-sm:min-h-(--touch)">
      <BrandMark />
      <span>
        <b className="block text-lg leading-[1.1] font-bold tracking-[-0.03em]">FitPulse</b>
        <span className="block font-mono text-xs leading-[1.2] tracking-[0.12em] text-text-muted uppercase max-sm:hidden">
          diagnóstico de crescimento
        </span>
      </span>
    </NavLink>
  );
}

function MainNav({ preferences }: { preferences: Preferences }) {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Principal"
      data-aioson-id="nav"
      data-aioson-tour="nav"
      className="flex flex-1 justify-center gap-1 max-md:justify-start max-sm:order-3 max-sm:basis-full max-sm:overflow-x-auto"
    >
      {buildNavItems(preferences).map((item) => {
        const isActive = isNavItemActive(item, pathname);
        return (
          <Link
            key={item.dataId}
            to={item.to}
            aria-current={isActive ? "page" : undefined}
            data-aioson-id={item.dataId}
            className={navLinkClassName(isActive)}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function HeaderTools({ usageMode, inWizard }: { usageMode: Preferences["usageMode"]; inWizard: boolean }) {
  return (
    <div className="flex items-center gap-3 max-sm:ml-auto">
      {usageMode && !inWizard ? (
        <span
          data-aioson-id="mode-chip"
          className="font-mono text-xs tracking-[0.1em] whitespace-nowrap text-text-muted uppercase max-sm:hidden"
        >
          {MODE_LABELS[usageMode]}
        </span>
      ) : null}
      <ThemeToggle />
      {inWizard ? null : <TourButton />}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  const { pathname } = useLocation();
  const inWizard = pathname === WIZARD_PATH || pathname.startsWith(`${WIZARD_PATH}/`);
  return (
    <>
      <SkipLink />
      <header data-aioson-id="top-bar" className="sticky top-0 z-20 px-6 pt-3 max-sm:px-3 max-sm:pt-2">
        <div
          className={cn(
            "mx-auto flex h-[60px] max-w-[1120px] items-center gap-6 rounded-lg border border-line px-4",
            "bg-[color-mix(in_oklab,var(--ground)_82%,transparent)] backdrop-blur-[10px] backdrop-saturate-[1.1]",
            "max-sm:h-auto max-sm:flex-wrap max-sm:gap-2 max-sm:px-3 max-sm:py-2",
          )}
        >
          <Brand />
          {inWizard ? <div className="flex-1" /> : <MainNav preferences={preferences} />}
          <HeaderTools usageMode={preferences.usageMode} inWizard={inWizard} />
        </div>
      </header>
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="mx-auto max-w-[1120px] px-6 pt-12 pb-24 [container-type:inline-size] focus:outline-none max-sm:px-4 max-sm:pt-8 max-sm:pb-16"
      >
        {children}
      </main>
    </>
  );
}
