import { getResponseList, Tinybird } from "@openstatus/tinybird";

import { env } from "@/env.mjs";
import MOCK from "@/mock/response-list.json";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

// rename if needed - too generic
export async function getData({ siteId }: { siteId?: string }) {
  let data = MOCK;
  if (process.env.NODE_ENV !== "development") {
    const res = await getResponseList(tb)({ siteId });
    data = res.data;
  }
  return data;
}
