import type { z } from "zod";

import type {
  Incident,
  Maintenance,
  PublicMonitor,
  selectPublicStatusReportSchemaWithRelation,
} from "@openstatus/db/src/schema";
import { OSTinybird } from "@openstatus/tinybird";

import { Tracker } from "@/components/tracker/tracker";
import { env } from "@/env";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

export const Monitor = async ({
  monitor,
  statusReports,
  incidents,
  maintenances,
  showValues,
}: {
  monitor: PublicMonitor;
  statusReports: z.infer<typeof selectPublicStatusReportSchemaWithRelation>[];
  incidents: Incident[];
  maintenances: Maintenance[];
  showValues?: boolean;
}) => {
  const data = await tb.endpointStatusPeriod("45d")({
    monitorId: String(monitor.id),
  });

  // TODO: we could handle the `statusReports` here instead of passing it down to the tracker

  if (!data) return <div>Something went wrong</div>;

  return (
    <Tracker
      data={data}
      reports={statusReports}
      incidents={incidents}
      maintenances={maintenances}
      showValues={showValues}
      {...monitor}
    />
  );
};
