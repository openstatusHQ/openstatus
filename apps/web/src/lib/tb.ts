import type { Region } from "@openstatus/tinybird";
import { getResponseList, Tinybird } from "@openstatus/tinybird";

import { env } from "@/env.mjs";
import MOCK from "@/mock/response-list.json";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

// rename if needed - too generic
export async function getData({
  siteId,
  region,
}: {
  siteId?: string;
  region?: Region;
}) {
  let data = MOCK;
  if (process.env.NODE_ENV !== "development") {
    const res = await getResponseList(tb)({ siteId, region });
    data = res.data;
  }
  return data;
}
