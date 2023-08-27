import type * as z from "zod";

import type { selectPublicMonitorSchema } from "@openstatus/db/src/schema";

export function AffectedMonitors({
  monitors,
}: {
  monitors: z.infer<typeof selectPublicMonitorSchema>[];
}) {
  return (
    <ul role="list">
      {monitors.length > 0 ? (
        monitors.map(({ name, url }, i) => (
          <li key={i} className="text-xs">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-muted-foreground/70 mx-1">&bull;</span>
            <span className="text-muted-foreground font-mono">{url}</span>
          </li>
        ))
      ) : (
        <li className="text-muted-foreground text-sm">Monitor(s) missing</li>
      )}
    </ul>
  );
}
