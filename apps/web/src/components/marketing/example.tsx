import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";

import { Button } from "@openstatus/ui";

import { Tracker } from "@/components/tracker";
import { getHomeMonitorListData } from "@/lib/tb";

const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export async function Example() {
  return (
    <div className="w-full text-center">
      <div className="mx-auto max-w-md">
        <Suspense fallback={<ExampleTrackerFallback />}>
          <ExampleTracker />
        </Suspense>
      </div>
      <Button asChild variant="outline" className="my-8 rounded-full">
        <Link href="/play">Playground</Link>
      </Button>
    </div>
  );
}

function ExampleTrackerFallback() {
  return (
    <Tracker
      data={[]}
      id={1}
      name="Ping"
      url="https://www.openstatus.dev/api/ping"
    />
  );
}

async function ExampleTracker() {
  const headersList = headers();
  const timezone = headersList.get("x-vercel-ip-timezone") || currentTimezone;
  const data = await getHomeMonitorListData({ timezone });
  if (!data) return null;
  return (
    <Tracker
      data={data}
      id={1}
      name="Ping"
      context="play"
      url="https://www.openstatus.dev/api/ping"
      timezone={timezone}
    />
  );
}
