import type { z } from "zod";

import type {
  Incident,
  Maintenance,
  PublicMonitor,
  selectPublicStatusReportSchemaWithRelation,
} from "@openstatus/db/src/schema";

import { Monitor } from "./monitor";

export const MonitorList = ({
  monitors,
  statusReports,
  incidents,
  maintenances,
  showMonitorValues,
  totalDays,
}: {
  monitors: PublicMonitor[];
  statusReports: z.infer<typeof selectPublicStatusReportSchemaWithRelation>[];
  incidents: Incident[];
  maintenances: Maintenance[];
  showMonitorValues?: boolean;
  totalDays?: number;
}) => {
  return (
    <div className="grid gap-4">
      {monitors.map((monitor, _index) => {
        const monitorStatusReport = statusReports.filter((statusReport) =>
          statusReport.monitorsToStatusReports.some(
            (i) => i.monitor.id === monitor.id,
          ),
        );
        const monitorIncidents = incidents.filter(
          (incident) => incident.monitorId === monitor.id,
        );
        const monitorMaintenances = maintenances.filter((maintenance) =>
          maintenance.monitors?.includes(monitor.id),
        );
        return (
          <Monitor
            key={monitor.id}
            monitor={monitor}
            statusReports={monitorStatusReport}
            incidents={monitorIncidents}
            maintenances={monitorMaintenances}
            showValues={showMonitorValues}
            totalDays={totalDays}
          />
        );
      })}
    </div>
  );
};
