/**
 * Type guard to check if a pageComponent is a monitor type with a valid monitor relation
 * Filters out external components and ensures the monitor is active and not deleted
 */
export function isMonitorComponent(component: {
  type: "monitor" | "external";
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
