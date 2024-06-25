import { OSTinybird } from "@openstatus/tinybird";

import { Shell } from "@/components/dashboard/shell";
import { Tracker } from "@/components/tracker/tracker";
import { env } from "@/env";
import { getServerTimezoneFormat } from "@/lib/timezone";
import { HeaderPlay } from "../../_components/header-play";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

export default async function StatusPlay() {
  const data = await tb.endpointStatusPeriod("45d")(
    {
      monitorId: "1",
    },
    {
      revalidate: 600, // 10 minutes
    },
  );

  const formattedServerDate = getServerTimezoneFormat();

  return (
    <Shell>
      <div className="relative grid gap-4">
        <HeaderPlay
          title="Status Page"
          description="Gain the trust of your users by showing them the uptime of your API or website."
        />
        <div className="mx-auto w-full max-w-md">
          {data && <Tracker data={data} name="Ping" description="Pong" />}
        </div>
        <p className="text-center text-muted-foreground text-sm">
          {formattedServerDate}
        </p>
        {/* REMINDER: more playground component  */}
      </div>
    </Shell>
  );
}
