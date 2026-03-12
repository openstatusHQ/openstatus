"use client";

import { cn } from "@openstatus/ui/lib/utils";
import {
  StatusBannerContainer,
  StatusBannerIcon,
} from "../status-banner";
import { StatusTimestamp } from "../status";

export function StatusBannerStatic({
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
        "data-[status=success]:bg-success/20",
        "data-[status=degraded]:bg-warning/20",
        "data-[status=error]:bg-destructive/20",
        "data-[status=info]:bg-info/20",
        className,
      )}
    >
      <StatusBannerIcon className="flex-shrink-0" />
      <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-xl">
          <span className="hidden group-data-[status=success]/status-banner:block">
            All Systems Operational
          </span>
          <span className="hidden group-data-[status=degraded]/status-banner:block">
            Degraded Performance
          </span>
          <span className="hidden group-data-[status=error]/status-banner:block">
            Downtime Performance
          </span>
          <span className="hidden group-data-[status=info]/status-banner:block">
            Maintenance
          </span>
        </div>
        <StatusTimestamp date={new Date()} className="text-xs" />
      </div>
    </StatusBannerContainer>
  );
}
