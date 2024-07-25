import Link from "next/link";
import { Suspense } from "react";

import { OSTinybird } from "@openstatus/tinybird";
import { Button } from "@openstatus/ui/src/components/button";

import { Tracker } from "@/components/tracker/tracker";
import { env } from "@/env";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

export async function TrackerExample() {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-8">
      <div className="mx-auto w-full max-w-md">
        <Suspense fallback={<ExampleTrackerFallback />}>
          <ExampleTracker />
        </Suspense>
      </div>
      <Button className="rounded-full" asChild>
        <Link href="/features/status-page">Learn more</Link>
      </Button>
    </div>
  );
}

function ExampleTrackerFallback() {
  return <Tracker data={[]} name="Ping" description="Pong" />;
}

async function ExampleTracker() {
  const data = await tb.endpointStatusPeriod("45d")(
    {
      monitorId: "1",
    },
    {
      revalidate: 600, // 10 minutes
    }
  );

  if (!data) return null;
  return <Tracker data={data} name="Ping" description="Pong" />;
}
