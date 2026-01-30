import type { PageComponentType } from "@openstatus/db/src/schema";

/**
 * Type guard to check if a pageComponent is a monitor type with a valid monitor relation
 * Filters out static components and ensures the monitor is active and not deleted
 */
export function isMonitorComponent(component: {
  type: PageComponentType;
  monitor?: { active: boolean | null; deletedAt: Date | null } | null;
}): component is {
  type: "monitor";
  monitor: { active: true; deletedAt: null };
} {
  return (
    component.type === "monitor" &&
    component.monitor !== null &&
    component.monitor !== undefined &&
    component.monitor.active === true &&
    component.monitor.deletedAt === null
  );
}
