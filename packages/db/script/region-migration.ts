import { z } from "zod";
import { db,  eq,  schema } from "../src";
import { selectMonitorSchema } from "../src/schema";
import  type {  monitorRegionSchema } from "../src/schema/constants";


const rawMonitors = await db.select().from(schema.monitor)

const monitors = z.array(selectMonitorSchema).parse(rawMonitors)
for (const monitor of monitors) {
    const regions = monitor.regions.slice()

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

    // Europe
    updateRegion("waw", "ams", regions);
    updateRegion("mad", "cdg", regions);
    updateRegion("otp", "fra", regions);

    // South America
    updateRegion("bog", "gru", regions);
    updateRegion("gig", "gru", regions);
    updateRegion("scl", "gru", regions);
    updateRegion("eze", "gru", regions);

  const newRegions = regions.join(",")
  await db.update(schema.monitor).set({ regions: newRegions }).where(eq(schema.monitor.id, monitor.id)).execute()

}

export function updateRegion(oldRegion: z.infer<typeof monitorRegionSchema>, newRegion: z.infer<typeof monitorRegionSchema>, regions:z.infer<typeof monitorRegionSchema>[]) {

  const regionIndex = regions.indexOf(oldRegion)
  if (regionIndex !== -1) {
    const newRegionIndex = regions.indexOf(newRegion)
    if (newRegionIndex === -1) {
      regions[regionIndex] = newRegion
    }
    if (newRegionIndex !== -1) {
      regions.splice(regionIndex, 1)
    }
  }
}
