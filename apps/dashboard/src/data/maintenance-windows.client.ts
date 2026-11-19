import type { MonitorMaintenanceWindowMode } from "@openstatus/db/src/schema/monitor_maintenance_windows/constants";
import { Delete, Settings, Stop } from "@openstatus/icons";

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
  pause: "No checks run, so nothing is measured for the window.",
  continue:
    "Checks run and are recorded as usual, but status changes and alerts are ignored.",
};

const actions = [
  { id: "edit", label: "Settings", icon: Settings, variant: "default" },
  { id: "end", label: "End now", icon: Stop, variant: "default" },
  { id: "delete", label: "Delete", icon: Delete, variant: "destructive" },
] as const;

export function getMaintenanceWindowActions(
  props: Partial<Record<"edit" | "end", () => Promise<void> | void>>,
) {
  return actions
    .filter((action) => action.id === "delete" || props[action.id])
    .map((action) => ({
      ...action,
      onClick: action.id === "delete" ? undefined : props[action.id],
    }));
}
