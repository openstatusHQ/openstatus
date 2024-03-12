import type { HomeStatsParams } from "@openstatus/tinybird";
import { getHomeStats, Tinybird } from "@openstatus/tinybird";

import { env } from "@/env";

// @depreciated in favor to use the OSTinybird client directly
const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

export async function getHomeStatsData(props: Partial<HomeStatsParams>) {
  try {
    const res = await getHomeStats(tb)(props);
    return res.data;
  } catch (e) {
    console.error(e);
  }
  return;
}
