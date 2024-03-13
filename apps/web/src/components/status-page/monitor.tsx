import type { z } from "zod";

import type {
  Incident,
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
}: {
  monitor: PublicMonitor;
  statusReports: z.infer<typeof selectPublicStatusReportSchemaWithRelation>[];
  incidents: Incident[];
}) => {
  const data = await tb.endpointStatusPeriod("45d")({
    monitorId: String(monitor.id),
    url: monitor.url,
  });

  // TODO: we could handle the `statusReports` here instead of passing it down to the tracker

  if (!data) return <div>Something went wrong</div>;

  return (
    <Tracker
      data={data}
      reports={statusReports}
      incidents={incidents}
      {...monitor}
    />
  );
};
