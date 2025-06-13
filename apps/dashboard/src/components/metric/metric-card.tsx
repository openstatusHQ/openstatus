import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";

const metricCardVariants = cva(
  "flex flex-col gap-1 border rounded-lg px-3 py-2 text-card-foreground",
  {
    variants: {
      variant: {
        default: "border-input bg-card",
        ghost: "border-transparent",
        destructive: "border-destructive/80 bg-destructive/10",
        success: "border-success/80 bg-success/10",
        warning: "border-warning/80 bg-warning/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export function MetricCard({
  children,
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof metricCardVariants>) {
  return (
    <div
      data-variant={variant}
      className={cn(metricCardVariants({ variant, className }), "group")}
      {...props}
    >
      {children}
    </div>
  );
}

export function MetricCardTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p className={cn("font-medium text-sm", className)} {...props}>
      {children}
    </p>
  );
}

export function MetricCardHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground",
        "group-data-[variant=destructive]:text-destructive",
        "group-data-[variant=success]:text-success",
        "group-data-[variant=warning]:text-warning",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function MetricCardValue({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p className={cn("font-semibold text-foreground", className)} {...props}>
      {children}
    </p>
  );
}

export function MetricCardGroup({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

const badgeVariants = cva("px-1.5 font-mono text-[10px]", {
  variants: {
    variant: {
      default: "border-border",
      increase:
        "border-destructive/20 bg-destructive/10 hover:bg-destructive/10 text-destructive",
      decrease:
        "border-success/20 bg-success/10 hover:bg-success/10 text-success",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export function MetricCardBadge({
  value,
  decimal = 1,
  className,
  ...props
}: React.ComponentProps<typeof Badge> & {
  value: number;
  decimal?: number;
}) {
  const round = 10 ** decimal; // 10^1 = 10 (1 decimal), 10^2 = 100 (2 decimals), etc.
  const percentage = Math.round((value - 1) * 100 * round) / round;

  const variant: VariantProps<typeof badgeVariants>["variant"] =
    percentage > 0 ? "increase" : percentage < 0 ? "decrease" : "default";

  return (
    <Badge
      variant="secondary"
      className={badgeVariants({ variant, className })}
      {...props}
    >
      {percentage !== 0 ? (
        <span>
          {percentage > 0 ? <ChevronUp className="mr-px size-2.5" /> : null}
          {percentage < 0 ? <ChevronDown className="mr-px size-2.5" /> : null}
        </span>
      ) : null}
      {Math.abs(percentage)}%
    </Badge>
  );
}

const metricCardButtonVariants = cva(
  "group w-full text-left transition-all rounded-md outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 cursor-pointer"
  // TODO: discuss if we want rings
);

export function MetricCardButton({
  children,
  className,
  variant,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof metricCardVariants>) {
  return (
    <button
      type="button"
      data-variant={variant}
      className={cn(
        metricCardVariants({ variant, className }),
        metricCardButtonVariants()
      )}
      {...props}
    >
      {children}
    </button>
  );
}
