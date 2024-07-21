import { notEmpty } from "@/lib/utils";
import type {
  Maintenance,
  PublicMonitor,
  StatusReportWithUpdates,
} from "@openstatus/db/src/schema";
import { EmptyState } from "../dashboard/empty-state";
import { DayHeader } from "./day-header";
import { MaintenanceContainer } from "./maintenance";
import { StatusReport } from "./status-report";

function isMaintenanceType(value: unknown): value is Maintenance {
  return (value as Maintenance).from !== undefined;
}

function isStatusReportType(value: unknown): value is StatusReportWithUpdates {
  return (value as StatusReportWithUpdates).statusReportUpdates !== undefined;
}

export function Feed({
  maintenances,
  monitors,
  statusReports,
}: {
  maintenances: Maintenance[];
  statusReports: StatusReportWithUpdates[];
  monitors: PublicMonitor[];
}) {
  if ([...maintenances, ...statusReports].length === 0) {
    return (
      <EmptyState icon="newspaper" title="No entries found." description="" />
    );
  }

  function groupByDay(
    maintenances: Maintenance[],
    statusReports: StatusReportWithUpdates[],
  ) {
    const grouped = [...maintenances, ...statusReports].reduce(
      (acc, element) => {
        const isMaintenance = isMaintenanceType(element);
        const isStatusReport = isStatusReportType(element);

        if (isMaintenance) {
          const date = new Date(element.from.toDateString()).getTime();

          const exists = acc.find((item) => item.timestamp === date);

          if (exists) {
            exists.list.push({ type: "maintenance", value: element });
          } else {
            acc.push({
              timestamp: date,
              list: [{ type: "maintenance", value: element }],
            });
          }
        }

        if (isStatusReport) {
          const firstUpdate = element.statusReportUpdates[0]; // make sure we get the correct order from backend query!
          const date = (
            firstUpdate
              ? new Date(firstUpdate?.date.toDateString())
              : new Date(new Date().toDateString())
          ).getTime();

          const exists = acc.find((item) => item.timestamp === date);

          if (exists) {
            exists.list.push({ type: "report", value: element });
          } else {
            acc.push({
              timestamp: date,
              list: [{ type: "report", value: element }],
            });
          }
        }

        return acc;
      },
      [] as {
        timestamp: number;
        list: (
          | {
              type: "maintenance";
              value: Maintenance;
            }
          | {
              type: "report";
              value: StatusReportWithUpdates;
            }
        )[];
      }[],
    );

    grouped.sort((a, b) => b.timestamp - a.timestamp);

    return grouped;
  }

  return (
    <div className="grid gap-8">
      {groupByDay(maintenances, statusReports).map((group) => {
        return (
          <div key={group.timestamp} className="grid gap-4">
            <DayHeader date={new Date(group.timestamp)} />
            {group.list.map((item, _i) => {
              if (item.type === "maintenance") {
                const affectedMonitors = item.value.monitors
                  ?.map((monitorId) => {
                    const monitor = monitors.find(({ id }) => monitorId === id);
                    return monitor || undefined;
                  })
                  .filter(notEmpty);

                return (
                  <MaintenanceContainer
                    key={item.value.id}
                    maintenance={item.value}
                    monitors={affectedMonitors || []}
                    className="rounded-lg border-status-monitoring/10 bg-status-monitoring/5"
                  />
                );
              }
              if (item.type === "report") {
                const affectedMonitors = item.value.monitorsToStatusReports
                  .map(({ monitorId }) => {
                    const monitor = monitors.find(({ id }) => monitorId === id);
                    return monitor || undefined;
                  })
                  .filter(notEmpty);

                return (
                  <div key={item.value.id} className="grid gap-6">
                    <StatusReport
                      monitors={affectedMonitors}
                      report={item.value}
                    />
                  </div>
                );
              }
              return null;
            })}
          </div>
        );
      })}
    </div>
  );
}
