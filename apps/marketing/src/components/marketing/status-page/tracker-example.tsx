import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@openstatus/ui/src/components/button";

import { Tracker } from "@/components/tracker/tracker";
import { prepareStatusByPeriod } from "@/lib/tb";

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
  const res = await prepareStatusByPeriod("45d").getData({
    monitorId: "1",
  });

  if (!res.data) return null;
  return <Tracker data={res.data} name="Ping" description="Pong" />;
}
