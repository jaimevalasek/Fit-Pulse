import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-semibold no-underline",
    "cursor-pointer select-none whitespace-nowrap",
    "transition-[border-color,background-color,transform] duration-(--fast) ease-app",
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:size-[18px] [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        // Neutral outline on the ground
        default: "border-line-strong bg-transparent text-text hover:border-text-soft hover:bg-surface",
        // App metal (antique bronze): the main action of a screen
        metal: "border-bronze bg-bronze text-bronze-contrast hover:bg-[color-mix(in_oklab,var(--bronze)_86%,var(--text))]",
        // Gold is reserved for gates (e.g. "Ver meu resultado")
        gate: "border-gold bg-gold text-gold-contrast hover:bg-[color-mix(in_oklab,var(--gold)_86%,var(--text))]",
        destructive: "border-danger bg-danger text-danger-contrast hover:bg-[color-mix(in_oklab,var(--danger)_86%,var(--text))]",
        ghost: "border-transparent bg-transparent text-text hover:border-line hover:bg-surface",
        link: "h-auto min-h-0 border-0 bg-transparent p-0 text-bronze underline underline-offset-3",
      },
      size: {
        default: "min-h-(--control) px-4 max-sm:min-h-(--touch)",
        sm: "min-h-8 px-3 text-xs max-sm:min-h-(--touch)",
        lg: "min-h-12 px-6 text-base",
        icon: "size-(--control) p-0 max-sm:size-(--touch)",
      },
    },
    compoundVariants: [{ variant: "link", className: "min-h-0 px-0 max-sm:min-h-0" }],
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      data-slot="button"
      data-variant={variant ?? "default"}
      type={asChild ? type : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
