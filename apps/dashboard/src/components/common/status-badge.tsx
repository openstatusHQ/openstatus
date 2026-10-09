import { Badge } from "@openstatus/ui/components/ui/badge";
import { cn } from "@openstatus/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

import { StatusDot, type StatusVariant } from "./status-dot";

const statusBadgeVariants = cva("", {
  variants: {
    variant: {
      default: "bg-muted/50",
      success: "border-success/20 bg-success/10 text-success",
      warning: "border-warning/20 bg-warning/10 text-warning",
      destructive: "border-destructive/20 bg-destructive/10 text-destructive",
      info: "border-info/20 bg-info/10 text-info",
    } satisfies Record<StatusVariant, string>,
  },
  defaultVariants: {
    variant: "default",
  },
});

/**
 * Tinted by `variant`; with `dot` it stays neutral and the dot carries the
 * color. `plain` drops the chrome for inline use in a sentence.
 */
export function StatusBadge({
  children,
  className,
  variant,
  dot = false,
  plain = false,
  ...props
}: Omit<React.ComponentProps<typeof Badge>, "variant"> &
  VariantProps<typeof statusBadgeVariants> & {
    dot?: boolean;
    plain?: boolean;
  }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono",
        dot || plain ? "gap-1.5" : statusBadgeVariants({ variant }),
        plain &&
          "rounded-none border-0 px-0 py-0 text-sm font-normal text-inherit",
        className,
      )}
      {...props}
    >
      {dot || plain ? <StatusDot variant={variant} /> : null}
      {children}
    </Badge>
  );
}
