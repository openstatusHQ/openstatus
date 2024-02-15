import { cva } from "class-variance-authority";
import type { z } from "zod";

import type {
  selectIncidentPageSchema,
  selectStatusReportPageSchema,
} from "@openstatus/db/src/schema";

import { getResponseListData } from "@/lib/tb";
import type { StatusVariant } from "@/lib/tracker";
import { calcStatus, isOnGoingIncidents } from "@/lib/tracker";
import { cn, notEmpty } from "@/lib/utils";
import { Icons } from "../icons";

const check = cva("border-border rounded-full border p-1.5", {
  variants: {
    variant: {
      up: "bg-green-500/80 border-green-500",
      down: "bg-red-500/80 border-red-500",
      degraded: "bg-yellow-500/80 border-yellow-500",
      empty: "bg-gray-500/80 border-gray-500",
      incident: "bg-yellow-500/80 border-yellow-500",
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
  const isIncident = statusReports.some(
    (incident) => !["monitoring", "resolved"].includes(incident.status),
  );
  // Need to filter out the incident that are resolved
  const onGoingIncidents = isOnGoingIncidents(incidents);

  // const status = calcStatus(monitorsData);

  const incident = {
    label: "Incident",
    variant: "incident",
  } as const;

  const up = {
    label: "Operational",
    variant: "up",
  } as const;

  const { label, variant } = isIncident || onGoingIncidents ? incident : up;

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

interface StatusIconProps {
  variant: StatusVariant | "incident";
  className?: string;
}

function StatusIcon({ variant, className }: StatusIconProps) {
  const rootClassName = cn("h-5 w-5 text-background", className);
  const MinusIcon = Icons["minus"];
  const CheckIcon = Icons["check"];
  const AlertTriangleIcon = Icons["alert-triangle"];
  if (variant === "incident") {
    return <AlertTriangleIcon className={rootClassName} />;
  }
  if (variant === "degraded") {
    return <MinusIcon className={rootClassName} />;
  }
  if (variant === "down") {
    return <MinusIcon className={rootClassName} />;
  }
  return <CheckIcon className={rootClassName} />;
}
