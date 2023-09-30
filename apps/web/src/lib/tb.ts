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
export async function getResponseListData(
  props: Partial<
    Pick<
      ResponseListParams,
      "region" | "cronTimestamp" | "page_size" | "monitorId" | "page"
    >
  >,
) {
  try {
    const res = await getResponseList(tb)(props);
    return res.data;
  } catch (e) {
    console.error(e);
  }
  return;
}

export async function getResponseListDataCount(
  props: Partial<
    Pick<
      ResponseListParams,
      "region" | "cronTimestamp" | "page_size" | "monitorId" | "page"
    >
  >,
) {
  try {
    const res = await getResponseList(tb)(props);
    return res.statistics?.rows_read || 0;
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(e.message);
    }
    throw new Error(`Something bad happened: ${JSON.stringify(e)}`);
  }
}

export async function getMonitorListData(props: Partial<MonitorListParams>) {
  try {
    const res = await getMonitorList(tb)(props);
    return res.data;
  } catch (e) {
    console.error(e);
  }
  return;
}

export async function getHomeMonitorListData() {
  try {
    const res = await getHomeMonitorList(tb)({ monitorId: "openstatusPing" });
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
