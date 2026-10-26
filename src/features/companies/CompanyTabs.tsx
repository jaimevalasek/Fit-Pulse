import { useEffect, useRef, type ReactNode } from "react";
import { NavLink } from "react-router";
import type { Company } from "@/api/companiesApi";

interface CompanyTab {
  slug: string;
  path: string;
  label: string;
  meta?: ReactNode;
}

// Bronze line under the active tab; it draws itself only when the system allows motion (AC-ra-58)
function ActiveTabLine() {
  const lineRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const line = lineRef.current;
    if (!line || typeof line.animate !== "function") return;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    const animation = line.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      duration: 360,
      easing: "cubic-bezier(.22,.61,.36,1)",
    });
    return () => animation.cancel();
  }, []);
  return <span ref={lineRef} aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-bronze" />;
}

function buildTabs(company: Company): CompanyTab[] {
  return [
    {
      slug: "diagnosticos",
      path: "",
      label: "Diagnósticos",
      meta: <span className="font-mono text-xs font-medium text-text-muted max-sm:hidden">{company.completedCount}</span>,
    },
    { slug: "acoes", path: "acoes", label: "Ações" },
    { slug: "diario", path: "diario", label: "Diário" },
    { slug: "relatorios", path: "relatorios", label: "Relatórios" },
  ];
}

// Route tabs of the company; they sit right under the header so "Relatórios" stays in the first fold at 1280 and 390 px (AC-ra-61)
function CompanyTabs({ company }: { company: Company }) {
  const base = `/empresa/${encodeURIComponent(company.id)}`;
  return (
    <nav aria-label="Seções da empresa" data-aioson-tour="abas" className="mb-4 flex gap-0.5 overflow-x-auto border-b border-line [scrollbar-width:none]">
      {buildTabs(company).map((tab) => (
        <NavLink
          key={tab.slug}
          to={tab.path ? `${base}/${tab.path}` : base}
          end
          data-aioson-id={`tab-${tab.slug}`}
          className={({ isActive }) =>
            [
              "relative -mb-px inline-flex min-h-(--touch) items-center gap-2 whitespace-nowrap px-3.5 font-semibold no-underline max-sm:px-2 max-sm:text-sm",
              "motion-safe:transition-colors hover:text-text",
              isActive ? "text-text" : "text-text-soft",
            ].join(" ")
          }
        >
          {({ isActive }) => (
            <>
              {tab.label}
              {tab.meta}
              {isActive ? <ActiveTabLine /> : null}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export { CompanyTabs };
