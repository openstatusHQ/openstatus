import type { z } from "zod";

import type {
  Incident,
  Maintenance,
  PublicMonitor,
  selectPublicStatusReportSchemaWithRelation,
} from "@openstatus/db/src/schema";

import { Tracker } from "@/components/tracker/tracker";
import { prepareStatusByPeriod } from "@/lib/tb";

export const Monitor = async ({
  monitor,
  statusReports,
  incidents,
  maintenances,
  showValues,
  totalDays,
}: {
  monitor: PublicMonitor;
  statusReports: z.infer<typeof selectPublicStatusReportSchemaWithRelation>[];
  incidents: Incident[];
  maintenances: Maintenance[];
  showValues?: boolean;
  totalDays?: number;
}) => {
  const res = await prepareStatusByPeriod(
    "45d",
    monitor.jobType as "http" | "tcp",
  ).getData({
    monitorId: String(monitor.id),
    days: totalDays,
  });

  // TODO: we could handle the `statusReports` here instead of passing it down to the tracker

  if (!res.data) return <div>Something went wrong</div>;

  return (
    <Tracker
      data={res.data}
      reports={statusReports}
      incidents={incidents}
      maintenances={maintenances}
      showValues={showValues}
      {...monitor}
    />
  );
};
