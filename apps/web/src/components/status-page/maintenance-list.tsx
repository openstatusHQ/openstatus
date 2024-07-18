import { notEmpty } from "@/lib/utils";
import type { Maintenance, PublicMonitor } from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui";
import { format } from "date-fns";
import { Fragment } from "react";
import { DayHeader } from "./day-header";
import { StatusReportHeader, StatusReportUpdates } from "./status-report";

export function MaintenanceList({
  maintenances,
  monitors,
}: {
  maintenances: Maintenance[];
  monitors: PublicMonitor[];
}) {
  if (!maintenances.length) {
    return <EmptyState />;
  }

  function groupMaintenancesByDay(maintenances: Maintenance[]) {
    const grouped = maintenances.reduce(
      (acc, maintenance) => {
        const date = new Date(maintenance.from.toDateString()).getTime();

        const exists = acc.find((item) => item.timestamp === date);

        if (exists) {
          exists.maintenances.push(maintenance);
        } else {
          acc.push({ timestamp: date, maintenances: [maintenance] });
        }

        return acc;
      },
      [] as { timestamp: number; maintenances: Maintenance[] }[]
    );

    grouped.sort((a, b) => b.timestamp - a.timestamp);

    return grouped;
  }

  return (
    <div className="grid gap-4">
      {groupMaintenancesByDay(maintenances).map((group) => {
        return (
          <Fragment key={group.timestamp}>
            <DayHeader date={new Date(group.timestamp)} />
            {group.maintenances.map((maintenance, i) => {
              const affectedMonitors = maintenance.monitors
                ?.map((monitorId) => {
                  const monitor = monitors.find(({ id }) => monitorId === id);
                  return monitor || undefined;
                })
                .filter(notEmpty);

              return (
                <div
                  key={maintenance.id}
                  className="grid gap-4 border border-transparent p-3"
                >
                  <StatusReportHeader
                    title={maintenance.title}
                    monitors={affectedMonitors || []}
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
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

function EmptyState() {
  return (
    <p className="text-center font-light text-muted-foreground text-sm">
      No maintenances reported.
    </p>
  );
}
