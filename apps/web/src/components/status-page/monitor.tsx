import type { z } from "zod";

import type { selectMonitorSchema } from "@openstatus/db/src/schema";

import { getMonitorListData } from "@/lib/tb";
import { Tracker } from "../tracker";

export const Monitor = async ({
  monitor,
}: {
  monitor: z.infer<typeof selectMonitorSchema>;
}) => {
  const data = await getMonitorListData({
    monitorId: String(monitor.id),
    groupBy: "day",
  });
  if (!data) return <div>Something went wrong</div>;
  return (
    <Tracker
      data={data}
      id={monitor.id}
      name={monitor.name}
      url={monitor.url}
      description={monitor.description}
      context="status-page"
      maxSize={40}
    />
  );
};
