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
    ? await getMonitorListData({ siteId: "openstatus", ...params })
    : await getMonitorListData({ siteId: "openstatus" });

  return (
    <div className="relative flex flex-col items-center justify-center gap-4">
      <div className="absolute right-2 top-2">
        <ToggleButton groupBy={params?.groupBy} />
      </div>
      <p className="font-cal mb-2 text-3xl">Status</p>
      <p className="text-lg font-light">Learn more on how to build your own.</p>
      {data && (
        <Tracker
          data={data}
          id="openstatus"
          name="Ping"
          url="https://openstatus.dev/api/ping"
        />
      )}
    </div>
  );
}
