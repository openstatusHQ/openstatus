import type { Maintenance, PublicMonitor } from "@openstatus/db/src/schema";
import { StatusReportHeader, StatusReportUpdates } from "./status-report";
import { cn } from "@/lib/utils";
import { DateTimeTooltip } from "./datetime-tooltip";

export function MaintenanceContainer({
  maintenance,
  monitors,
  className,
}: {
  maintenance: Maintenance;
  monitors: PublicMonitor[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 border border-transparent p-3", className)}>
      <StatusReportHeader
        title={maintenance.title}
        monitors={monitors || []}
        // <DateTimeTooltip date={new Date()} />
        actions={
          <p className="font-mono text-muted-foreground text-xs">
            <DateTimeTooltip date={maintenance.from} /> -{" "}
            <DateTimeTooltip date={maintenance.to} />
          </p>
        }
      />
      <StatusReportUpdates
        updates={[
          {
            message: maintenance.message,
            id: maintenance.id,
            status: "maintenance",
          },
        ]}
      />
    </div>
  );
}
