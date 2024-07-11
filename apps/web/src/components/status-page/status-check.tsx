import type {
  Incident,
  Maintenance,
  StatusReport,
} from "@openstatus/db/src/schema";
import type { StatusVariant } from "@openstatus/tracker";
import { Tracker } from "@openstatus/tracker";

import { cn } from "@/lib/utils";
import { Icons } from "../icons";
import { DateTimeTooltip } from "./datetime-tooltip";

export async function StatusCheck({
  statusReports,
  incidents,
  maintenances,
}: {
  statusReports?: StatusReport[];
  incidents?: Incident[];
  maintenances?: Maintenance[];
}) {
  const tracker = new Tracker({ statusReports, incidents, maintenances });
  const className = tracker.currentClassName;
  const details = tracker.currentDetails;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <h2 className="font-semibold text-xl">{details.long}</h2>
        <span className={cn("rounded-full border p-1.5", className)}>
          <StatusIcon variant={details.variant} />
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <p className="text-muted-foreground text-xs">Status Check</p>
        <span className="text-muted-foreground/50 text-xs">•</span>{" "}
        <p className="text-xs">
          <DateTimeTooltip date={new Date()} />
        </p>
      </div>
    </div>
  );
}

export function StatusIcon({ variant }: { variant: StatusVariant }) {
  if (variant === "incident") {
    const AlertTriangleIcon = Icons["alert-triangle"];
    return <AlertTriangleIcon className="h-5 w-5 text-background" />;
  }
  if (variant === "maintenance") {
    return <Icons.hammer className="h-5 w-5 text-background" />;
  }
  if (variant === "degraded") {
    return <Icons.minus className="h-5 w-5 text-background" />;
  }
  if (variant === "down") {
    return <Icons.minus className="h-5 w-5 text-background" />;
  }
  return <Icons.check className="h-5 w-5 text-background" />;
}
