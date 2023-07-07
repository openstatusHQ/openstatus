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
import MOCK_RESPONSE from "@/mock/response-list.json";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

// TODO: add security layer
export async function getResponseListData(
  props: Partial<
    Pick<ResponseListParams, "siteId" | "region" | "cronTimestamp" | "limit">
  >,
) {
  let data = MOCK_RESPONSE;
  if (process.env.NODE_ENV !== "development") {
    const res = await getResponseList(tb)(props);
    data = res.data;
  }
  return data;
}

export async function getMonitorListData(props: Partial<MonitorListParams>) {
  const res = await getMonitorList(tb)(props);
  return res.data;
}
