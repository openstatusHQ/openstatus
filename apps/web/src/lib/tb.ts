import type {
  HomeStatsParams,
  MonitorListParams,
  ResponseListParams,
} from "@openstatus/tinybird";
import {
  getHomeMonitorList,
  getHomeStats,
  getMonitorList,
  getResponseList,
  Tinybird,
} from "@openstatus/tinybird";

import { env } from "@/env";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

// TODO: add security layer
export async function getResponseListData(props: Partial<ResponseListParams>) {
  try {
    const res = await getResponseList(tb)(props);
    return res.data;
  } catch (e) {
    console.error(e);
  }
  return;
}

export async function getMonitorListData(props: MonitorListParams) {
  try {
    const res = await getMonitorList(tb)(props);
    return res.data;
  } catch (e) {
    console.error(e);
  }
  return;
}

// Includes caching of data for 10 minutes
export async function getHomeMonitorListData(
  props: Pick<MonitorListParams, "timezone">,
) {
  try {
    const res = await getHomeMonitorList(tb)({ monitorId: "1", ...props });
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
