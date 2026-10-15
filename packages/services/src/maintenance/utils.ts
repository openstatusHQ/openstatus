import type { MaintenanceUpdate } from "../types";

/** Newest entry by date, then id; the public `message` of a maintenance. */
export function latestMaintenanceUpdate<
  T extends Pick<MaintenanceUpdate, "date" | "id">,
>(updates: ReadonlyArray<T>): T | undefined {
  let latest: T | undefined;
  for (const update of updates) {
    if (
      !latest ||
      update.date.getTime() > latest.date.getTime() ||
      (update.date.getTime() === latest.date.getTime() && update.id > latest.id)
    ) {
      latest = update;
    }
  }
  return latest;
}
