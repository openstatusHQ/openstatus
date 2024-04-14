import { format, formatDistanceStrict } from "date-fns";

import type {
  Monitor,
  StatusReport,
  StatusReportUpdate,
} from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui";

import { StatusBadge } from "./status-badge";

export function Summary({
  report,
  monitors,
}: {
  report: StatusReport & { statusReportUpdates: StatusReportUpdate[] };
  monitors: Pick<Monitor, "name">[];
}) {
  const firstUpdate = report.statusReportUpdates?.[0];
  const lastUpdate =
    report.statusReportUpdates?.[report.statusReportUpdates.length - 1];

  return (
    <div className="grid grid-cols-5 gap-3 text-sm">
      <p className="text-muted-foreground col-start-1">Started</p>
      <p className="col-span-4">
        {firstUpdate ? (
          <code>{format(new Date(firstUpdate.date), "LLL dd, y HH:mm")}</code>
        ) : null}
      </p>
      <p className="text-muted-foreground col-start-1">Status</p>
      <div className="col-span-4 flex items-center gap-2">
        <StatusBadge status={report.status} />
        {firstUpdate && lastUpdate && report.status === "resolved" ? (
          <span className="text-muted-foreground text-xs">
            after {formatDistanceStrict(firstUpdate.date, lastUpdate.date)}
          </span>
        ) : null}
      </div>
      <p className="text-muted-foreground col-start-1">Affected</p>
      <ul role="list" className="col-span-4 flex gap-2">
        {monitors.length > 0 ? (
          monitors.map(({ name }, i) => (
            <li key={i} className="text-xs">
              <Badge variant="outline">{name}</Badge>
            </li>
          ))
        ) : (
          <li>-</li>
        )}
      </ul>
    </div>
  );
}
