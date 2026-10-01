import { z } from "zod";

import { db, eq, schema } from "../src";
import { selectMonitorSchema } from "../src/schema";
import type { monitorRegionSchema } from "../src/schema/constants";

// Only run against the DB when executed directly, not when imported by tests.
if (import.meta.main) {
  const rawMonitors = await db.select().from(schema.monitor);

  const monitors = z.array(selectMonitorSchema).parse(rawMonitors);
  for (const monitor of monitors) {
    const regions = monitor.regions.slice();
    // Asia Pacific
    updateRegion("bom", "sin", regions);
    const newRegions = regions.join(",");
    if (newRegions === monitor.regions.join(",")) continue;
    await db
      .update(schema.monitor)
      .set({ regions: newRegions })
      .where(eq(schema.monitor.id, monitor.id))
      .execute();
  }
}

export function updateRegion(
  oldRegion: z.infer<typeof monitorRegionSchema>,
  newRegion: z.infer<typeof monitorRegionSchema>,
  regions: z.infer<typeof monitorRegionSchema>[],
) {
  const regionIndex = regions.indexOf(oldRegion);
  if (regionIndex !== -1) {
    const newRegionIndex = regions.indexOf(newRegion);
    if (newRegionIndex === -1) {
      regions[regionIndex] = newRegion;
    }
    if (newRegionIndex !== -1) {
      regions.splice(regionIndex, 1);
    }
  }
}
