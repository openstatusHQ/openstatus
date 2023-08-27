import * as z from "zod";

import { groupByRange } from "@openstatus/tinybird";

import { Tracker } from "@/components/tracker";
import { getMonitorListData } from "@/lib/tb";
import { ToggleButton } from "./toggle-button";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  groupBy: z.enum(groupByRange).optional(),
});

export default async function PlayPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);
  const params = search.success ? search.data : undefined;

  const data = search.success
    ? await getMonitorListData({ monitorId: "openstatusPing", ...params })
    : await getMonitorListData({ monitorId: "openstatusPing" });

  return (
    <div className="relative flex flex-col items-center justify-center gap-4">
      <div className="absolute right-2 top-2">
        <ToggleButton groupBy={params?.groupBy} />
      </div>
      <p className="font-cal mb-1 text-3xl">Status</p>
      <p className="text-muted-foreground text-lg font-light">
        Build your own within seconds.
      </p>
      <div className="mx-auto w-full max-w-md">
        {data && (
          <Tracker
            data={data}
            id="openstatusPing"
            name="Ping"
            url="https://www.openstatus.dev/api/ping"
          />
        )}
      </div>
    </div>
  );
}
