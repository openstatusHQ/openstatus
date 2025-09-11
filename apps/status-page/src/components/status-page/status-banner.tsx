import { cn } from "@/lib/utils";
import {
  AlertCircleIcon,
  CheckIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from "lucide-react";
import { messages } from "./messages";
import { StatusTimestamp } from "./status";

export function StatusBanner({
  className,
  status,
}: React.ComponentProps<"div"> & {
  status?: "success" | "degraded" | "error" | "info";
}) {
  return (
    <StatusBannerContainer
      status={status}
      className={cn(
        "flex items-center gap-3 px-3 py-2 sm:px-4 sm:py-3",
        className,
      )}
    >
      <StatusBannerIcon className="flex-shrink-0" />
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
  status,
}: React.ComponentProps<"div"> & {
  status?: "success" | "degraded" | "error" | "info";
}) {
  return (
    <div
      data-slot="status-banner"
      data-status={status}
      className={cn(
        "group/status-banner overflow-hidden rounded-lg border",
        "data-[status=success]:border-success",
        "data-[status=degraded]:border-warning",
        "data-[status=error]:border-destructive",
        "data-[status=info]:border-info",
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
      <span className="hidden group-data-[status=success]/status-banner:block">
        {messages.long.success}
      </span>
      <span className="hidden group-data-[status=degraded]/status-banner:block">
        {messages.long.degraded}
      </span>
      <span className="hidden group-data-[status=error]/status-banner:block">
        {messages.long.error}
      </span>
      <span className="hidden group-data-[status=info]/status-banner:block">
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
        "group-data-[status=success]/status-banner:bg-success",
        "group-data-[status=degraded]/status-banner:bg-warning",
        "group-data-[status=error]/status-banner:bg-destructive",
        "group-data-[status=info]/status-banner:bg-info",
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

export function StatusBannerIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex size-7 items-center justify-center rounded-full bg-muted text-background [&>svg]:size-4",
        "group-data-[status=success]/status-banner:bg-success",
        "group-data-[status=degraded]/status-banner:bg-warning",
        "group-data-[status=error]/status-banner:bg-destructive",
        "group-data-[status=info]/status-banner:bg-info",
        className,
      )}
      {...props}
    >
      <CheckIcon className="hidden group-data-[status=success]/status-banner:block" />
      <TriangleAlertIcon className="hidden group-data-[status=degraded]/status-banner:block" />
      <AlertCircleIcon className="hidden group-data-[status=error]/status-banner:block" />
      <WrenchIcon className="hidden group-data-[status=info]/status-banner:block" />
    </div>
  );
}
