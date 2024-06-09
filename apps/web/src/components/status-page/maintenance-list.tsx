import { notEmpty } from "@/lib/utils";
import type { Maintenance, PublicMonitor } from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui";
import { format, isSameDay } from "date-fns";

export function MaintenanceList({
  maintenances,
  monitors,
}: {
  maintenances: Maintenance[];
  monitors: PublicMonitor[];
}) {
  if (!maintenances.length) {
    return <EmptyState />;
  }

  return (
    <ul className="grid gap-6">
      {maintenances.map((maintenance) => {
        const maintenanceMonitors = maintenance.monitors
          ?.map((id) => {
            return monitors.find((monitor) => monitor.id === id);
          })
          .filter(notEmpty);
        return (
          <li key={maintenance.id} className="grid gap-3">
            <div>
              <h3 className="font-semibold text-xl">{maintenance.title}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-muted-foreground text-sm">
                  {format(maintenance.from, "LLL dd, y HH:mm")} -{" "}
                  {isSameDay(maintenance.from, maintenance.to)
                    ? format(maintenance.to, "HH:mm")
                    : format(maintenance.to, "LLL dd, y HH:mm")}
                </span>
                {maintenanceMonitors?.length ? (
                  <>
                    <span className="text-muted-foreground/50 text-xs">•</span>
                    {maintenanceMonitors.map((monitor) => (
                      <Badge key={monitor.id} variant="secondary">
                        {monitor.name}
                      </Badge>
                    ))}
                  </>
                ) : null}
              </div>
            </div>
            <p>{maintenance.message}</p>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyState() {
  return (
    <p className="text-center font-light text-muted-foreground text-sm">
      No maintenances reported.
    </p>
  );
}
