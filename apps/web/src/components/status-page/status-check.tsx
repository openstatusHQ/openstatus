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
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3",
        containerClassName(details.variant),
      )}
    >
      <span className={cn("rounded-full border p-1.5", className)}>
        <StatusIcon variant={details.variant} />
      </span>
      <div className="flex w-full flex-wrap items-center justify-between gap-1">
        <h2 className="font-semibold text-xl">{details.long}</h2>
        <p className="text-xs">
          <DateTimeTooltip date={new Date()} />
        </p>
      </div>
    </div>
  );
}

function containerClassName(variant: StatusVariant) {
  if (variant === "incident") return "bg-status-down/10 border-status-down/20";
  if (variant === "maintenance")
    return "bg-status-monitoring/10 border-status-monitoring/20";
  if (variant === "degraded")
    return "bg-status-degraded/10 border-status-degraded/20";
  if (variant === "down") return "bg-status-down/10 border-status-down/20";
  return "bg-status-operational/10 border-status-operational/20";
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
