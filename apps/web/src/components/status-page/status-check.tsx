import { cva } from "class-variance-authority";
import type { z } from "zod";

import type {
  selectIncidentPageSchema,
  selectStatusReportPageSchema,
} from "@openstatus/db/src/schema";
import { Tracker } from "@openstatus/tracker";

import { cn } from "@/lib/utils";
import { Icons } from "../icons";

export async function StatusCheck({
  statusReports,
  incidents,
}: {
  statusReports: z.infer<typeof selectStatusReportPageSchema>;
  incidents: z.infer<typeof selectIncidentPageSchema>;
}) {
  const tracker = new Tracker({ statusReports, incidents });
  const className = tracker.currentClassName;
  const variant = tracker.currentVariant;
  const label = tracker.toString;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <p className="text-lg font-semibold">{label}</p>
        <span className={cn("rounded-full border p-1.5", className)}>
          <StatusIcon variant={variant} />
        </span>
      </div>
      <p className="text-muted-foreground text-xs">Status Check</p>
    </div>
  );
}

export function StatusIcon({ variant }: { variant: string }) {
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
