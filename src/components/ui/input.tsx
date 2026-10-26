import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "h-(--control) w-full min-w-0 rounded-md border border-line-strong bg-ground-sunken px-3 text-base text-text",
        "transition-[border-color,background-color] duration-(--fast) ease-app",
        "placeholder:text-text-muted hover:border-text-soft focus:border-bronze focus-visible:rounded-md",
        "disabled:cursor-not-allowed disabled:opacity-45",
        // Invalid wins over valid: the error border and wash stay until the value is fixed
        "data-[valid=true]:border-ok aria-invalid:border-danger aria-invalid:bg-danger-wash",
        "max-sm:h-(--touch)",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
