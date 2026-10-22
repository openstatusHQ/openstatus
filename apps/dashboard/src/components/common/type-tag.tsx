import { cn } from "@openstatus/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

import type { StatusVariant } from "./status-dot";

const typeTagVariants = cva(
  "inline-flex h-6 w-11 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-medium tracking-wide no-underline",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground border-transparent",
        success: "border-success/20 bg-success/10 text-success",
        warning: "border-warning/20 bg-warning/10 text-warning",
        destructive: "border-destructive/20 bg-destructive/10 text-destructive",
        info: "border-info/20 bg-info/10 text-info",
      } satisfies Record<StatusVariant, string>,
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/** A three-letter code for an event kind (`INC`), tinted by its state; `label` spells it out. */
export function TypeTag({
  children,
  label,
  variant,
  className,
  ...props
}: Omit<React.ComponentProps<"abbr">, "title"> &
  VariantProps<typeof typeTagVariants> & { label: string }) {
  return (
    <abbr
      data-slot="type-tag"
      title={label}
      aria-label={label}
      className={cn(typeTagVariants({ variant }), className)}
      {...props}
    >
      {children}
    </abbr>
  );
}
