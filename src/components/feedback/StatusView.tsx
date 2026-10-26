import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StatusState = "loading" | "empty" | "error";

interface StatusViewProps {
  state: StatusState;
  title?: ReactNode;
  description?: ReactNode;
  // Main action of the state, e.g. "Cadastrar a primeira empresa" or "Limpar filtros"
  action?: ReactNode;
  // Shown on the error state as the "Tentar de novo" button
  onRetry?: () => void;
  retryLabel?: string;
  icon?: ReactNode;
  className?: string;
  dataId?: string;
}

const DEFAULT_TITLES: Record<StatusState, string> = {
  loading: "Carregando…",
  empty: "Nada por aqui ainda",
  error: "Não foi possível carregar",
};

function StatusIcon({ state }: { state: StatusState }) {
  if (state === "loading") {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 size-6 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-bronze"
      />
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-6 shrink-0", state === "error" ? "text-danger" : "text-bronze")}
    >
      <circle cx="12" cy="12" r="9" />
      {state === "error" ? <path d="M12 7.5v5.5M12 16.5h.01" /> : <path d="M12 11v5.5M12 7.5h.01" />}
    </svg>
  );
}

function StatusView({
  state,
  title,
  description,
  action,
  onRetry,
  retryLabel = "Tentar de novo",
  icon,
  className,
  dataId,
}: StatusViewProps) {
  const role = state === "error" ? "alert" : state === "loading" ? "status" : undefined;
  const showRetry = state === "error" && onRetry !== undefined;

  return (
    <div
      data-state={state}
      data-aioson-id={dataId}
      role={role}
      aria-busy={state === "loading" || undefined}
      className={cn(
        "flex items-start gap-4 rounded-lg border border-dashed border-line-strong bg-surface p-6",
        className,
      )}
    >
      {icon ?? <StatusIcon state={state} />}
      <div className="min-w-0">
        <b className="mb-0.5 block text-base">{title ?? DEFAULT_TITLES[state]}</b>
        {description ? <p className="text-sm text-text-soft">{description}</p> : null}
        {action || showRetry ? (
          <div className="mt-3 flex flex-wrap gap-3">
            {showRetry ? (
              <Button variant="default" onClick={onRetry}>
                {retryLabel}
              </Button>
            ) : null}
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { StatusView };
export type { StatusState, StatusViewProps };
