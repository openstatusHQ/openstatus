import { notFound } from "next/navigation";
import * as z from "zod";

import { Label } from "@openstatus/ui";

import { Tracker } from "@/components/tracker";
import { getHomeMonitorListData } from "@/lib/tb";
import { convertTimezoneToGMT, getRequestHeaderTimezone } from "@/lib/timezone";
import { TimezoneCombobox } from "./_components/timezone-combobox";

const supportedTimezones = Intl.supportedValuesOf("timeZone");

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  timezone: z.string().optional(),
});

export default async function PlayPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);
  const requestTimezone = getRequestHeaderTimezone();

  if (!search.success) {
    return notFound();
  }

  if (
    search.data.timezone &&
    !supportedTimezones.includes(search.data.timezone)
  ) {
    return notFound();
  }

  const gmt = convertTimezoneToGMT(search.data.timezone);

  const data = await getHomeMonitorListData({ timezone: gmt });

  return (
    <div className="relative grid gap-4">
      <div className="mx-auto grid gap-4 text-center">
        <p className="font-cal mb-1 text-3xl">Status</p>
        <p className="text-muted-foreground text-lg font-light">
          Build your own within seconds.
        </p>
      </div>
      <div className="mx-auto w-full max-w-md">
        {data && (
          <Tracker
            data={data}
            id={1}
            name="Ping"
            url="https://www.openstatus.dev/api/ping"
            context="play"
          />
        )}
      </div>
      <div className="mt-6 flex justify-start">
        <div className="grid items-center gap-1">
          <Label className="text-muted-foreground text-xs">Timezone</Label>
          <TimezoneCombobox
            defaultValue={search.data.timezone || requestTimezone || undefined}
          />
        </div>
      </div>
    </div>
  );
}
