import { Suspense } from "react";
import Link from "next/link";

import { Button } from "@openstatus/ui";

import { Tracker } from "@/components/tracker";
import { getHomeMonitorListData } from "@/lib/tb";
import { convertTimezoneToGMT } from "@/lib/timezone";

export async function TrackerExample() {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-8">
      <div className="mx-auto w-full max-w-md">
        <Suspense fallback={<ExampleTrackerFallback />}>
          <ExampleTracker />
        </Suspense>
      </div>
      <Button asChild variant="outline" className="rounded-full">
        <Link href="/play/status">Playground</Link>
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
  const gmt = convertTimezoneToGMT();
  const data = await getHomeMonitorListData({ timezone: gmt });
  if (!data) return null;
  return (
    <Tracker
      data={data}
      id={1}
      name="Ping"
      context="play"
      url="https://www.openstatus.dev/api/ping"
    />
  );
}
