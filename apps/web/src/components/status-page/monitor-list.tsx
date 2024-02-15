import type { z } from "zod";

import type {
  selectIncidentPageSchema,
  selectPublicMonitorSchema,
  selectPublicStatusReportSchemaWithRelation,
} from "@openstatus/db/src/schema";

import { Monitor } from "./monitor";

export const MonitorList = ({
  monitors,
  statusReports,
  incidents,
}: {
  monitors: z.infer<typeof selectPublicMonitorSchema>[];
  statusReports: z.infer<typeof selectPublicStatusReportSchemaWithRelation>[];
  incidents: z.infer<typeof selectIncidentPageSchema>;
}) => {
  return (
    <div className="grid gap-4">
      {monitors.map((monitor, index) => {
        const monitorStatusReport = statusReports.filter((statusReport) =>
          statusReport.monitorsToStatusReports.some(
            (i) => i.monitor.id === monitor.id,
          ),
        );
        const incident = incidents.filter(
          (incident) => incident.monitorId === monitor.id,
        );
        return (
          <Monitor
            key={index}
            monitor={monitor}
            statusReports={monitorStatusReport}
            incidents={incident}
          />
        );
      })}
    </div>
  );
};
