import { OSTinybird } from "@openstatus/tinybird";

import {
  CardContainer,
  CardDescription,
  CardHeader,
  CardIcon,
  CardTitle,
} from "@/components/marketing/card";
import { Tracker } from "@/components/tracker/tracker";
import { env } from "@/env";
import { getServerTimezoneFormat } from "@/lib/timezone";

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
    <CardContainer>
      <CardHeader>
        <CardIcon icon="panel-top" />
        <CardTitle>Status Page</CardTitle>
        <CardDescription className="max-w-md">
          Gain the trust of your users by showing them the uptime of your API or
          website.
        </CardDescription>
      </CardHeader>
      <div className="relative grid gap-4">
        <div className="mx-auto w-full max-w-md">
          {data && <Tracker data={data} name="Ping" description="Pong" />}
        </div>
        <p className="text-center text-muted-foreground text-sm">
          {formattedServerDate}
        </p>
        {/* REMINDER: more playground component  */}
      </div>
    </CardContainer>
  );
}
