import type { z } from "zod";

import type {
  Incident,
  PublicMonitor,
  selectPublicStatusReportSchemaWithRelation,
} from "@openstatus/db/src/schema";

import { Tracker } from "@/components/tracker/tracker";
import { getMonitorListData } from "@/lib/tb";
import { convertTimezoneToGMT } from "@/lib/timezone";

export const Monitor = async ({
  monitor,
  statusReports,
  incidents,
}: {
  monitor: PublicMonitor;
  statusReports: z.infer<typeof selectPublicStatusReportSchemaWithRelation>[];
  incidents: Incident[];
}) => {
  const gmt = convertTimezoneToGMT();
  const data = await getMonitorListData({
    monitorId: String(monitor.id),
    timezone: gmt,
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
