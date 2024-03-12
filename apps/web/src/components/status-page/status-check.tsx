import type { Incident, StatusReport } from "@openstatus/db/src/schema";
import type { StatusVariant } from "@openstatus/tracker";
import { Tracker } from "@openstatus/tracker";

import { getServerTimezoneFormat } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { Icons } from "../icons";

export async function StatusCheck({
  statusReports,
  incidents,
}: {
  statusReports: StatusReport[];
  incidents: Incident[];
}) {
  const tracker = new Tracker({ statusReports, incidents });
  const className = tracker.currentClassName;
  const details = tracker.currentDetails;

  const serverDate = getServerTimezoneFormat();

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <p className="text-lg font-semibold">{details.long}</p>
        <span className={cn("rounded-full border p-1.5", className)}>
          <StatusIcon variant={details.variant} />
        </span>
      </div>
      <p className="text-muted-foreground text-xs">
        Status Check <span className="text-muted-foreground/50 text-xs">•</span>{" "}
        {serverDate}
      </p>
    </div>
  );
}

export function StatusIcon({ variant }: { variant: StatusVariant }) {
  if (variant === "incident") {
    const AlertTriangleIcon = Icons["alert-triangle"];
    return <AlertTriangleIcon className="text-background h-5 w-5" />;
  }
  if (variant === "degraded") {
    return <Icons.minus className="text-background h-5 w-5" />;
  }
  if (variant === "down") {
    return <Icons.minus className="text-background h-5 w-5" />;
  }
  return <Icons.check className="text-background h-5 w-5" />;
}
