import type { z } from "zod";

import type { selectMonitorSchema } from "@openstatus/db/src/schema";

import { Monitor } from "./monitor";

export const MonitorList = ({
  monitors,
}: {
  monitors: z.infer<typeof selectMonitorSchema>[];
}) => {
  return (
    <div>
      {monitors.map((monitor, index) => (
        <div key={index}>
          {/* Fetch tracker and data */}
          <Monitor monitor={monitor} />
        </div>
      ))}
    </div>
  );
};
