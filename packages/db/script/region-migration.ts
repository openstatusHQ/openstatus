import { z } from "zod";
import { db, schema } from "../src";
import { selectMonitorSchema } from "../src/schema";
import type { monitorRegionSchema } from "../src/schema/constants";

const rawMonitors = await db.select().from(schema.monitor);

const monitors = z.array(selectMonitorSchema).parse(rawMonitors);
for (const monitor of monitors) {
  const oldRegions = monitor.regions.join(",");
  const regions = monitor.regions.slice();
  // Asia Pacific
  updateRegion("hkg", "sin", regions);

  // North America
  updateRegion("atl", "dfw", regions);
  updateRegion("mia", "dfw", regions);
  updateRegion("gdl", "dfw", regions);
  updateRegion("qro", "dfw", regions);
  updateRegion("bos", "ewr", regions);
  updateRegion("phx", "lax", regions);
  updateRegion("sea", "sjc", regions);
  updateRegion("yul", "yyz", regions);
  updateRegion("den", "dfw", regions);

  // Europe
  updateRegion("waw", "ams", regions);
  updateRegion("mad", "cdg", regions);
  updateRegion("otp", "fra", regions);

  // South America
  updateRegion("bog", "gru", regions);
  updateRegion("gig", "gru", regions);
  updateRegion("scl", "gru", regions);
  updateRegion("eze", "gru", regions);
  const newRegions = regions.join(",");
  if (newRegions !== oldRegions) {
    console.log("Updating regions for monitor:", monitor.id);
    // await db
    //   .update(schema.monitor)
    //   .set({ regions: newRegions })
    //   .where(eq(schema.monitor.id, monitor.id))
    //   .execute();
  }
  console.log("old regions:", oldRegions);
  console.log("new regions:", newRegions);
}

console.log(monitors.length);
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
