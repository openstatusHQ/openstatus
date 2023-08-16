import type {
  MonitorListParams,
  ResponseListParams,
} from "@openstatus/tinybird";
import {
  getMonitorList,
  getResponseList,
  Tinybird,
} from "@openstatus/tinybird";

import { env } from "@/env";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

// TODO: add security layer
export async function getResponseListData(
  props: Partial<
    Pick<ResponseListParams, "region" | "cronTimestamp" | "limit" | "monitorId">
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

export async function getMonitorListData(props: Partial<MonitorListParams>) {
  try {
    const res = await getMonitorList(tb)(props);
    return res.data;
  } catch (e) {
    console.error(e);
  }
  return;
}
