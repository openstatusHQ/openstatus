import type { z } from "zod";

import type { selectPublicMonitorSchema } from "@openstatus/db/src/schema";

import { Monitor } from "./monitor";

export const MonitorList = ({
  monitors,
}: {
  monitors: z.infer<typeof selectPublicMonitorSchema>[];
}) => {
  return (
    <div className="grid gap-4">
      {monitors.map((monitor, index) => (
        <div key={index}>
          {/* Fetch tracker and data */}
          <Monitor monitor={monitor} />
        </div>
      ))}
    </div>
  );
};
