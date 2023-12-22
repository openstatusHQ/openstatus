import { headers } from "next/headers";
import type { z } from "zod";

import type {
  selectPublicMonitorSchema,
  selectPublicStatusReportSchemaWithRelation,
} from "@openstatus/db/src/schema";

import { getMonitorListData } from "@/lib/tb";
import { Tracker } from "../tracker";

const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export const Monitor = async ({
  monitor,
  statusReports,
}: {
  monitor: z.infer<typeof selectPublicMonitorSchema>;
  statusReports: z.infer<typeof selectPublicStatusReportSchemaWithRelation>[];
}) => {
  const headersList = headers();
  const timezone = headersList.get("x-vercel-ip-timezone") || currentTimezone;

  const data = await getMonitorListData({
    monitorId: String(monitor.id),
    timezone,
  });

  // TODO: we could handle the `statusReports` here instead of passing it down to the tracker

  if (!data) return <div>Something went wrong</div>;

  return <Tracker data={data} reports={statusReports} {...monitor} />;
};
