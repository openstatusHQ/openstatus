import { cva } from "class-variance-authority";
import type { z } from "zod";

import type {
  selectIncidentPageSchema,
  selectStatusReportPageSchema,
} from "@openstatus/db/src/schema";

import { getStatusByRatio, incidentStatus } from "@/lib/tracker";
import type { StatusVariant } from "@/lib/tracker";
import { cn } from "@/lib/utils";
import { Icons } from "../icons";

const check = cva("rounded-full border p-1.5", {
  variants: {
    variant: {
      up: "bg-green-500/80 border-green-500",
      down: "bg-rose-500/80 border-rose-500",
      degraded: "bg-amber-500/80 border-amber-500",
      empty: "bg-gray-500/80 border-gray-500",
      incident: "bg-amber-500/80 border-amber-500",
    },
  },
  defaultVariants: {
    variant: "up",
  },
});

export async function StatusCheck({
  statusReports,
  incidents,
}: {
  statusReports: z.infer<typeof selectStatusReportPageSchema>;
  incidents: z.infer<typeof selectIncidentPageSchema>;
}) {
  const isStatusReport = statusReports.some(
    (incident) => !["monitoring", "resolved"].includes(incident.status),
  );
  const isIncident = incidents.some((incident) => incident.resolvedAt === null);

  // Forcing the status to be either 'degraded' or 'up'
  const status = getStatusByRatio(isIncident ? 0.5 : 1);

  const { label, variant } = isStatusReport ? incidentStatus : status;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <p className="text-lg font-semibold">{label}</p>
        <span className={check({ variant })}>
          <StatusIcon variant={variant} />
        </span>
      </div>
      <p className="text-muted-foreground text-xs">Status Check</p>
    </div>
  );
}

export interface StatusIconProps {
  variant: StatusVariant | "incident";
  className?: string;
}

export function StatusIcon({ variant, className }: StatusIconProps) {
  const rootClassName = cn("h-5 w-5 text-background", className);
  if (variant === "incident") {
    const AlertTriangleIcon = Icons["alert-triangle"];
    return <AlertTriangleIcon className={rootClassName} />;
  }
  if (variant === "degraded") {
    return <Icons.minus className={rootClassName} />;
  }
  if (variant === "down") {
    return <Icons.minus className={rootClassName} />;
  }
  return <Icons.check className={rootClassName} />;
}
