import type { Maintenance, PublicMonitor } from "@openstatus/db/src/schema";
import { StatusReportHeader, StatusReportUpdates } from "./status-report";
import { format } from "date-fns";

export function MaintenanceContainer({
  maintenance,
  monitors,
}: {
  maintenance: Maintenance;
  monitors: PublicMonitor[];
}) {
  return (
    <div className="grid gap-4 border border-transparent p-3">
      <StatusReportHeader
        title={maintenance.title}
        monitors={monitors || []}
        actions={
          <p className="font-mono text-muted-foreground text-sm">
            {format(maintenance.from, "LLL dd HH:mm")} -{" "}
            {format(maintenance.to, "LLL dd HH:mm")}
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
