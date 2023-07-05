import type { ResponseListParams } from "@openstatus/tinybird";
import { getResponseList, Tinybird } from "@openstatus/tinybird";

import { env } from "@/env.mjs";
import MOCK from "@/mock/response-list.json";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

export async function getResponseListData({
  siteId,
  region,
}: Pick<ResponseListParams, "siteId" | "region">) {
  let data = MOCK;
  if (process.env.NODE_ENV !== "development") {
    const res = await getResponseList(tb)({ siteId, region });
    data = res.data;
  }
  return data;
}
