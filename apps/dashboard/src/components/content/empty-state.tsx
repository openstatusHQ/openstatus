import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Icon, what belongs here, why it is empty, one action, one escape hatch.
 * `inline` is the single-row size for inside a table or card; `plain` drops
 * the dashed border when the parent already draws one.
 */
export function EmptyStateContainer({
  children,
  className,
  inline,
  plain,
  ...props
}: React.ComponentProps<"div"> & { inline?: boolean; plain?: boolean }) {
  return (
    <div
      data-slot="empty-state-container"
      data-inline={inline ? "" : undefined}
      className={cn(
        "border-border flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center",
        inline && "flex-row flex-wrap gap-2 py-3 text-left",
        plain && "border-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

const emptyStateMediaVariants = cva(
  "bg-background flex size-9 shrink-0 items-center justify-center rounded-lg border in-data-[inline]:size-auto in-data-[inline]:border-0 in-data-[inline]:bg-transparent [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "border-border text-muted-foreground",
        success: "border-success/20 bg-success/10 text-success",
        warning: "border-warning/20 bg-warning/10 text-warning",
        destructive: "border-destructive/20 bg-destructive/10 text-destructive",
        info: "border-info/20 bg-info/10 text-info",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function EmptyStateMedia({
  children,
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyStateMediaVariants>) {
  return (
    <div
      data-slot="empty-state-media"
      aria-hidden
      className={cn(emptyStateMediaVariants({ variant }), className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function EmptyStateTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-state-title"
      className={cn(
        "text-foreground text-sm font-medium in-data-[inline]:font-normal",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export function EmptyStateDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-state-description"
      className={cn(
        "text-muted-foreground max-w-sm text-sm text-balance in-data-[inline]:max-w-none",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export function EmptyStateActions({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state-actions"
      className={cn(
        "mt-2 flex flex-wrap items-center justify-center gap-2 in-data-[inline]:mt-0 in-data-[inline]:ml-auto",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
