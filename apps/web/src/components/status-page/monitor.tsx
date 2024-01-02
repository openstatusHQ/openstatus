import type { z } from "zod";

import type {
  selectPublicMonitorSchema,
  selectPublicStatusReportSchemaWithRelation,
} from "@openstatus/db/src/schema";

import { getMonitorListData } from "@/lib/tb";
import { convertTimezoneToGMT } from "@/lib/timezone";
import { Tracker } from "../tracker";

export const Monitor = async ({
  monitor,
  statusReports,
}: {
  monitor: z.infer<typeof selectPublicMonitorSchema>;
  statusReports: z.infer<typeof selectPublicStatusReportSchemaWithRelation>[];
}) => {
  const gmt = convertTimezoneToGMT();
  const data = await getMonitorListData({
    monitorId: String(monitor.id),
    timezone: gmt,
  });

  // TODO: we could handle the `statusReports` here instead of passing it down to the tracker

  if (!data) return <div>Something went wrong</div>;

  return <Tracker data={data} reports={statusReports} {...monitor} />;
};
