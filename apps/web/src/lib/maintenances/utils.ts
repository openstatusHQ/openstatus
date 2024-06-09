import type { Maintenance } from "@openstatus/db/src/schema";

export function isActiveMaintenance(maintenances?: Maintenance[]) {
  if (!maintenances) return false;
  return maintenances.some((maintenance) => {
    return maintenance.from <= new Date() && maintenance.to >= new Date();
  });
}
