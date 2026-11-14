/** pause: checks stop. continue: checks run; status changes and alerts are ignored. */
export const monitorMaintenanceWindowModes = ["pause", "continue"] as const;
export type MonitorMaintenanceWindowMode =
  (typeof monitorMaintenanceWindowModes)[number];
