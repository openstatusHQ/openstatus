import type { ResponseListParams } from "@openstatus/tinybird";
import { getResponseList, Tinybird } from "@openstatus/tinybird";

import { env } from "@/env.mjs";
import MOCK from "@/mock/response-list.json";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

// TODO: add security layer
export async function getResponseListData(
  props: Pick<ResponseListParams, "siteId" | "region" | "cronTimestamp">,
) {
  let data = MOCK;
  if (process.env.NODE_ENV !== "development") {
    const res = await getResponseList(tb)(props);
    data = res.data;
  }
  return data;
}
