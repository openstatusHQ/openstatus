import type { MonitorMaintenanceWindowMode } from "@openstatus/db/src/schema/monitor_maintenance_windows/constants";
import { Delete, Settings, StatusPage, Stop } from "@openstatus/icons";

export const maintenanceWindowModeLabels: Record<
  MonitorMaintenanceWindowMode,
  string
> = {
  pause: "Pause checks",
  continue: "Keep checking",
};

export const maintenanceWindowModeDescriptions: Record<
  MonitorMaintenanceWindowMode,
  string
> = {
  pause:
    "No checks run. The time is unmeasured, so it never counts against uptime and can never be excused later.",
  continue:
    "Checks run as usual, but status changes and alerts are ignored. The time counts towards uptime unless you excuse it in a reporting.",
};

const actions = [
  { id: "edit", label: "Settings", icon: Settings, variant: "default" },
  { id: "end", label: "End now", icon: Stop, variant: "default" },
  {
    id: "announce",
    label: "Announce on status page",
    icon: StatusPage,
    variant: "default",
  },
  { id: "delete", label: "Delete", icon: Delete, variant: "destructive" },
] as const;

export function getMaintenanceWindowActions(
  props: Partial<
    Record<"edit" | "end" | "announce", () => Promise<void> | void>
  >,
) {
  return actions
    .filter((action) => action.id === "delete" || props[action.id])
    .map((action) => ({
      ...action,
      onClick: action.id === "delete" ? undefined : props[action.id],
    }));
}
