import Link from "next/link";
import type { z } from "zod";

import type { selectPublicMonitorSchema } from "@openstatus/db/src/schema";

import { EmptyState } from "../dashboard/empty-state";
import { Button } from "../ui/button";
import { Monitor } from "./monitor";

export const MonitorList = ({
  monitors,
}: {
  monitors: z.infer<typeof selectPublicMonitorSchema>[];
}) => {
  const url =
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://www.openstatus.dev";
  return (
    <div className="grid gap-4">
      {Boolean(monitors.length) ? (
        monitors.map((monitor, index) => (
          <div key={index}>
            {/* Fetch tracker and data */}
            <Monitor monitor={monitor} />
          </div>
        ))
      ) : (
        <EmptyState
          icon="activity"
          title="Missing Monitors"
          description="Fill your status page with monitors."
          action={
            <Button asChild>
              <Link href={`${url}/app`}>Go to Dashboard</Link>
            </Button>
          }
        />
      )}
    </div>
  );
};
