import { cva } from "class-variance-authority";
import type { z } from "zod";

import type {
  selectPublicMonitorSchema,
  selectStatusReportPageSchema,
} from "@openstatus/db/src/schema";

import { getResponseListData } from "@/lib/tb";
import type { StatusVariant } from "@/lib/tracker";
import { getStatus } from "@/lib/tracker";
import { cn, notEmpty } from "@/lib/utils";
import { Icons } from "../icons";

const check = cva("border-border rounded-full border p-2", {
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
  monitors,
}: {
  statusReports: z.infer<typeof selectStatusReportPageSchema>;
  monitors: z.infer<typeof selectPublicMonitorSchema>[];
}) {
  const isIncident = statusReports.some(
    (incident) => !["monitoring", "resolved"].includes(incident.status),
  );

  const monitorsData = (
    await Promise.all(
      monitors.map((monitor) => {
        return getResponseListData({
          monitorId: String(monitor.id),
          limit: 10,
        });
      }),
    )
  ).filter(notEmpty);

  function calcStatus() {
    const { count, ok } = monitorsData.flat(1).reduce(
      (prev, curr) => {
        if (!curr.statusCode) return prev; // TODO: handle this better
        const isOk = curr.statusCode <= 299 && curr.statusCode >= 200;
        return { count: prev.count + 1, ok: prev.ok + (isOk ? 1 : 0) };
      },
      { count: 0, ok: 0 },
    );
    const status = getStatus(ok / count);
    return status;
  }

  const status = calcStatus();
  const incident = {
    label: "Incident",
    variant: "incident",
  } as const;

  const { label, variant } = isIncident ? incident : status;

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
