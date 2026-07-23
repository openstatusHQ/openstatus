import { cn } from "@openstatus/ui/lib/utils";

export function StatusChartContent({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-chart-content"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusChartHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-chart-header"
      className={cn("flex flex-col", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusChartTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-chart-title"
      className={cn("text-foreground text-base font-medium", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusChartDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-chart-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}
