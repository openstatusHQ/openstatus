import type { z } from "zod";

import type {
  selectPublicMonitorSchema,
  selectPublicStatusReportSchemaWithRelation,
} from "@openstatus/db/src/schema";

import { Monitor } from "./monitor";

export const MonitorList = ({
  monitors,
  statusReports,
}: {
  monitors: z.infer<typeof selectPublicMonitorSchema>[];
  statusReports: z.infer<typeof selectPublicStatusReportSchemaWithRelation>[];
}) => {
  return (
    <div className="grid gap-4">
      {monitors.map((monitor, index) => {
        const monitorStatusReport = statusReports.filter((statusReport) =>
          statusReport.monitorsToStatusReports.some(
            (i) => i.monitor.id === monitor.id,
          ),
        );
        return (
          <Monitor
            // biome-ignore lint/suspicious/noArrayIndexKey:
            key={index}
            monitor={monitor}
            statusReports={monitorStatusReport}
          />
        );
      })}
    </div>
  );
};
