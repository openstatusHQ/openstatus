import type { HomeStatsParams, MonitorListParams } from "@openstatus/tinybird";
import {
  getHomeMonitorList,
  getHomeStats,
  getMonitorList,
  Tinybird,
} from "@openstatus/tinybird";

import { env } from "@/env";

// @depreciated in favor to use the OSTinybird client directly
const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

// REMINDER: includes yet timezone
export async function getMonitorListData(props: MonitorListParams) {
  try {
    const res = await getMonitorList(tb)(props);
    return res.data;
  } catch (e) {
    console.error(e);
  }
  return;
}

// REMINDER: includes yet timezone
export async function getHomeMonitorListData(
  props: Pick<MonitorListParams, "timezone">,
) {
  try {
    const res = await getHomeMonitorList(tb)({
      monitorId: "1",
      ...props,
      url: "https://www.openstatus.dev",
    });
    return res.data;
  } catch (e) {
    console.error(e);
  }
  return;
}

export async function getHomeStatsData(props: Partial<HomeStatsParams>) {
  try {
    const res = await getHomeStats(tb)(props);
    return res.data;
  } catch (e) {
    console.error(e);
  }
  return;
}
