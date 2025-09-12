import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { UTCDate } from "@date-fns/utc";
import { format } from "date-fns";
import {
  AlertCircleIcon,
  CheckIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from "lucide-react";

export function Status({
  children,
  className,
  variant = "success",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "success" | "degraded" | "error" | "info";
}) {
  return (
    <div
      data-variant={variant}
      data-slot="status"
      className={cn("group peer flex flex-col gap-8", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusBrand({
  src,
  alt,
  className,
  ...props
}: React.ComponentProps<"img">) {
  return (
    // biome-ignore lint/a11y/useAltText: <explanation>
    <img src={src} alt={alt} className={cn("size-8", className)} {...props} />
  );
}

export function StatusHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-header"
      className={cn("@container/status-header", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "font-semibold text-foreground text-lg leading-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusDescription({
  children,
  className,
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-muted-foreground", className)}>{children}</div>
  );
}

export function StatusContent({
  children,
  className,
}: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-3", className)}>{children}</div>;
}

export function StatusIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex size-7 items-center justify-center rounded-full bg-muted text-background [&>svg]:size-4",
        "group-data-[variant=success]:bg-success",
        "group-data-[variant=degraded]:bg-warning",
        "group-data-[variant=error]:bg-destructive",
        "group-data-[variant=info]:bg-info",
        className,
      )}
      {...props}
    >
      <CheckIcon className="hidden group-data-[variant=success]:block" />
      <TriangleAlertIcon className="hidden group-data-[variant=degraded]:block" />
      <AlertCircleIcon className="hidden group-data-[variant=error]:block" />
      <WrenchIcon className="hidden group-data-[variant=info]:block" />
    </div>
  );
}

export function StatusTimestamp({
  date,
  className,
  ...props
}: React.ComponentProps<typeof TooltipTrigger> & { date: Date }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className={cn(
            "font-mono text-muted-foreground underline decoration-muted-foreground/30 decoration-dashed underline-offset-4",
            className,
          )}
          {...props}
        >
          {format(new UTCDate(date), "LLL dd, y HH:mm (z)")}
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-mono">{format(date, "LLL dd, y HH:mm (z)")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function StatusEmptyState({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-center sm:px-8 sm:py-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusEmptyStateTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("font-medium", className)} {...props}>
      {children}
    </div>
  );
}

export function StatusEmptyStateDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-muted-foreground text-sm", className)} {...props}>
      {children}
    </div>
  );
}
