import type { z } from "zod";

import type { selectMonitorSchema } from "@openstatus/db/src/schema";

import { getMonitorListData } from "@/lib/tb";
import { Tracker } from "../monitor/tracker";

export const Monitor = async ({
  monitor,
}: {
  monitor: z.infer<typeof selectMonitorSchema>;
}) => {
  const data = await getMonitorListData({
    siteId: "openstatus", // TODO: use proper id
    groupBy: "day",
  });

  if (!data) return <div>Something went wrong</div>;

  return (
    <Tracker
      data={data}
      id="openstatus"
      name="Ping"
      url="https://openstatus.dev/api/ping"
      context="status-page"
    />
  );
};
