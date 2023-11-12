import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";

import { Button } from "@openstatus/ui";

import { Shell } from "@/components/dashboard/shell";
import { Tracker } from "@/components/tracker";
import { getHomeMonitorListData } from "@/lib/tb";

export async function Example() {
  return (
    <Shell className="text-center">
      <h2 className="font-cal mb-3 text-2xl">Status</h2>
      <Button asChild variant="outline" className="rounded-full">
        <Link href="/play">Playground</Link>
      </Button>
      <div className="mx-auto max-w-md">
        <Suspense fallback={<ExampleTrackerFallback />}>
          <ExampleTracker />
        </Suspense>
      </div>
    </Shell>
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
  // "Asia/Tokyo" | "Europe/London" | "America/New_York" | "Australia/Sydney" ...
  const timezone =
    headersList.get("x-vercel-ip-timezone") || "Australia/Sydney"; // GTM
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
