import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { UTCDate } from "@date-fns/utc";
import {
  AlertCircleIcon,
  CheckIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from "lucide-react";
import { messages } from "./messages";

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
        "text-foreground text-lg leading-none font-semibold",
        className
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
  return <div className={cn("flex flex-col gap-6", className)}>{children}</div>;
}

export function StatusBanner({ className }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border rounded-lg p-3",
        "group-data-[variant=success]:bg-success/10 group-data-[variant=success]:border-success/20",
        "group-data-[variant=degraded]:bg-warning/10 group-data-[variant=degraded]:border-warning/20",
        "group-data-[variant=error]:bg-destructive/10 group-data-[variant=error]:border-destructive/20",
        "group-data-[variant=info]:bg-info/10 group-data-[variant=info]:border-info/20",
        className
      )}
    >
      <StatusIcon className="flex-shrink-0" />
      <div className="flex-1 flex items-center justify-between flex-wrap gap-2">
        <StatusBannerMessage className="font-semibold text-xl" />
        <StatusTimestamp date={new Date()} className="text-xs" />
      </div>
    </div>
  );
}

export function StatusBannerMessage({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn(className)} {...props}>
      <span className="hidden group-data-[variant=success]:block">
        {messages.long.success}
      </span>
      <span className="hidden group-data-[variant=degraded]:block">
        {messages.long.degraded}
      </span>
      <span className="hidden group-data-[variant=error]:block">
        {messages.long.error}
      </span>
      <span className="hidden group-data-[variant=info]:block">
        {messages.long.info}
      </span>
    </div>
  );
}

export function StatusIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "size-8 text-background rounded-full bg-muted flex items-center justify-center [&>svg]:size-4",
        "group-data-[variant=success]:bg-success",
        "group-data-[variant=degraded]:bg-warning",
        "group-data-[variant=error]:bg-destructive",
        "group-data-[variant=info]:bg-info",
        className
      )}
      {...props}
    >
      <CheckIcon className="group-data-[variant=success]:block hidden" />
      <TriangleAlertIcon className="group-data-[variant=degraded]:block hidden" />
      <AlertCircleIcon className="group-data-[variant=error]:block hidden" />
      <WrenchIcon className="group-data-[variant=info]:block hidden" />
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
        {/* TODO: add outline focus */}
        <TooltipTrigger
          className={cn(
            "font-mono text-muted-foreground underline decoration-muted-foreground/30 decoration-dashed underline-offset-4",
            className
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
