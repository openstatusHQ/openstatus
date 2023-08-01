import { Receiver } from "@upstash/qstash/cloudflare";
import { nanoid } from "nanoid";
import type { z } from "zod";

import {
  publishPingResponse,
  tbIngestPingResponse,
  Tinybird,
} from "@openstatus/tinybird";

import { env } from "@/env";
import { isAuthorizedDomain } from "../_shared";
import { payloadSchema } from "../schema";

export const monitorSchema = tbIngestPingResponse.pick({
  url: true,
  cronTimestamp: true,
});

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

const monitor = async (
  res: { text: () => Promise<string>; status: number },
  monitorInfo: z.infer<typeof payloadSchema>,
  region: string,
  latency: number,
) => {
  const text = (await res.text()) || "";
  if (monitorInfo.pageIds.length > 0) {
    for (const pageId of monitorInfo.pageIds) {
      const { pageIds, ...rest } = monitorInfo;
      await publishPingResponse(tb)({
        ...rest,
        id: nanoid(), // TBD: we don't need it
        pageId: pageId,
        timestamp: Date.now(),
        statusCode: res.status,
        latency,
        region,
        metadata: JSON.stringify({ text }),
      });
    }
  } else {
    const { pageIds, ...rest } = monitorInfo;

    await publishPingResponse(tb)({
      ...rest,
      id: nanoid(), // TBD: we don't need it
      pageId: "",
      timestamp: Date.now(),
      statusCode: res.status,
      latency,
      region,
      metadata: JSON.stringify({ text }),
    });
  }
};

export const checker = async (request: Request, region: string) => {
  if (!isAuthorizedDomain(request.url)) {
    return;
  }
  const jsonData = await request.json();

  const result = payloadSchema.safeParse(jsonData);

  if (!result.success) {
    throw new Error("Invalid response body");
  }
  let res: Response;
  try {
    const startTime = Date.now();
    res = await fetch(result.data.url, { cache: "no-store" });

    const endTime = Date.now();
    const latency = endTime - startTime;
    await monitor(res, result.data, region, latency);
  } catch (e) {
    // if on the third retry we still get an error, we should report it
    try {
      const startTime = Date.now();
      res = await fetch(result.data.url, { cache: "no-store" });

      const endTime = Date.now();
      const latency = endTime - startTime;
      await monitor(res, result.data, region, latency);
    } catch (e) {
      console.log(e);
      await monitor(
        { status: 500, text: () => Promise.resolve(`${e}`) },
        result.data,
        region,
        -1,
      );
    }
  }
};
