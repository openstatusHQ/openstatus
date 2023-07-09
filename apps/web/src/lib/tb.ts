import type {
  MonitorListParams,
  ResponseListParams,
} from "@openstatus/tinybird";
import {
  getMonitorList,
  getResponseList,
  Tinybird,
} from "@openstatus/tinybird";

import { env } from "@/env.mjs";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

// TODO: add security layer
export async function getResponseListData(
  props: Partial<
    Pick<ResponseListParams, "siteId" | "region" | "cronTimestamp" | "limit">
  >,
) {
  const res = await getResponseList(tb)(props);
  return res.data;
}

export async function getMonitorListData(props: Partial<MonitorListParams>) {
  const res = await getMonitorList(tb)(props);
  return res.data;
}
