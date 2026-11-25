import { z } from "zod";

import { db, eq, schema } from "../src";
import { selectMonitorSchema } from "../src/schema";
import type { monitorRegionSchema } from "../src/schema/constants";

type MonitorRegion = z.infer<typeof monitorRegionSchema>;

// Every deprecated region and its replacement. Earlier entries already ran;
// they stay because re-applying them is a no-op.
export const REGION_REMAPS: ReadonlyArray<[MonitorRegion, MonitorRegion]> = [
  // Asia Pacific
  ["hkg", "sin"],
  ["bom", "sin"],
  // North America
  ["atl", "dfw"],
  ["mia", "dfw"],
  ["gdl", "dfw"],
  ["qro", "dfw"],
  ["bos", "ewr"],
  ["phx", "lax"],
  ["sea", "sjc"],
  ["yul", "yyz"],
  ["den", "dfw"],
  // Europe
  ["waw", "ams"],
  ["mad", "cdg"],
  ["otp", "fra"],
  // South America
  ["bog", "gru"],
  ["gig", "gru"],
  ["scl", "gru"],
  ["eze", "gru"],
];

export function applyRegionRemaps(regions: MonitorRegion[]) {
  for (const [from, to] of REGION_REMAPS) {
    // `updateRegion` handles one occurrence; a region can be listed twice.
    while (regions.includes(from)) updateRegion(from, to, regions);
  }
}

// Only run against the DB when executed directly, not when imported by tests.
if (import.meta.main) {
  const rawMonitors = await db.select().from(schema.monitor);

  const monitors = z.array(selectMonitorSchema).parse(rawMonitors);
  for (const monitor of monitors) {
    const regions = monitor.regions.slice();
    applyRegionRemaps(regions);
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
