import {
  CardContainer,
  CardDescription,
  CardHeader,
  CardIcon,
  CardTitle,
} from "@/components/marketing/card";
import { Tracker } from "@/components/tracker/tracker";
import { env } from "@/env";
import { prepareStatusByPeriod } from "@/lib/tb";
import { getServerTimezoneFormat } from "@/lib/timezone";

export default async function StatusPlay() {
  const res = await prepareStatusByPeriod("45d").getData({ monitorId: "1" });
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
          {res.data && (
            <Tracker data={res.data} name="Ping" description="Pong" />
          )}
        </div>
        <p className="text-center text-muted-foreground text-sm">
          {formattedServerDate}
        </p>
        {/* REMINDER: more playground component  */}
      </div>
    </CardContainer>
  );
}
