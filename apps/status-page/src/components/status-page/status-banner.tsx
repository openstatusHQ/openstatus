import { cn } from "@/lib/utils";
import { messages } from "./messages";
import { StatusIcon, StatusTimestamp } from "./status";

export function StatusBanner({ className }: React.ComponentProps<"div">) {
  return (
    <StatusBannerContainer
      className={cn(
        "flex items-center gap-3 px-3 py-2 sm:px-4 sm:py-3",
        className,
      )}
    >
      <StatusIcon className="flex-shrink-0" />
      <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
        <StatusBannerMessage className="font-semibold text-xl" />
        <StatusTimestamp date={new Date()} className="text-xs" />
      </div>
    </StatusBannerContainer>
  );
}

export function StatusBannerContainer({
  className,
  children,
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border",
        "group-data-[variant=success]:border-success",
        "group-data-[variant=degraded]:border-warning",
        "group-data-[variant=error]:border-destructive",
        "group-data-[variant=info]:border-info",
        className,
      )}
    >
      {children}
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

export function StatusBannerTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "px-3 py-2 text-background sm:px-4 sm:py-3",
        "group-data-[variant=success]:bg-success",
        "group-data-[variant=degraded]:bg-warning",
        "group-data-[variant=error]:bg-destructive",
        "group-data-[variant=info]:bg-info",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusBannerContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("px-3 py-2 sm:px-4 sm:py-3", className)} {...props}>
      {children}
    </div>
  );
}
