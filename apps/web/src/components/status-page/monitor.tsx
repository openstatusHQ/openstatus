import { headers } from "next/headers";
import type { z } from "zod";

import type { selectPublicMonitorSchema } from "@openstatus/db/src/schema";

import { getMonitorListData } from "@/lib/tb";
import { Tracker } from "../tracker";

const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export const Monitor = async ({
  monitor,
}: {
  monitor: z.infer<typeof selectPublicMonitorSchema>;
}) => {
  const headersList = headers();
  const timezone = headersList.get("x-vercel-ip-timezone") || currentTimezone;

  const data = await getMonitorListData({
    monitorId: String(monitor.id),
    timezone,
  });
  if (!data) return <div>Something went wrong</div>;

  return (
    <Tracker
      data={data}
      id={monitor.id}
      name={monitor.name}
      url={monitor.url}
      description={monitor.description}
    />
  );
};
