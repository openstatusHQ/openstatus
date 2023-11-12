import { headers } from "next/headers";
import * as z from "zod";

import { Label } from "@openstatus/ui";

import { Tracker } from "@/components/tracker";
import { getHomeMonitorListData } from "@/lib/tb";
import { TimezoneCombobox } from "./_components/timezone-combobox";

const supportedTimezones = Intl.supportedValuesOf("timeZone");
const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
  const headersList = headers();
  const timezone = headersList.get("x-vercel-ip-timezone") || currentTimezone;

  const search = searchParamsSchema.safeParse(searchParams);

  function getDefaultValue() {
    if (
      search.success &&
      search.data.timezone &&
      supportedTimezones.includes(search.data.timezone)
    ) {
      return search.data.timezone;
    }
    return timezone;
  }

  const defaultValue = getDefaultValue();

  const data = await getHomeMonitorListData({ timezone: defaultValue });

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
            timezone={defaultValue}
          />
        )}
      </div>
      <div className="mt-6 flex justify-start">
        <div className="grid items-center gap-1">
          <Label className="text-muted-foreground text-xs">Timezone</Label>
          <TimezoneCombobox defaultValue={defaultValue} />
        </div>
      </div>
    </div>
  );
}
