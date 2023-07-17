import type { z } from "zod";

import type { selectMonitorSchema } from "@openstatus/db/src/schema";

import { getMonitorListData } from "@/lib/tb";
import { Tracker } from "../monitor/tracker";

export const Monitor = async ({
  monitor,
}: {
  monitor: z.infer<typeof selectMonitorSchema>;
}) => {
  // fix this we should update our tinybird to fetch with  pageId and monitorId
  //   const data = await getMonitorListData({ siteId: String(monitor.pageId) });
  const data = await getMonitorListData({ siteId: "openstatus" });

  if (!data) return <div>Something went wrong</div>;

  return (
    <div className="border-border rounded-lg border p-8">
      <h1 className="font-cal mb-3 text-center text-2xl">Status</h1>
      <Tracker
        data={data}
        id="openstatus"
        name="Ping"
        url="https://openstatus.dev/api/ping"
      />
    </div>
  );
};
