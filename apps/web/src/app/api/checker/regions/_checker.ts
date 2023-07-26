import { Receiver } from "@upstash/qstash/cloudflare";
import { nanoid } from "nanoid";
import type { z } from "zod";

import { page } from "@openstatus/db/src/schema";
import {
  publishPingResponse,
  tbIngestPingResponse,
  Tinybird,
} from "@openstatus/tinybird";

import { env } from "@/env.mjs";
import { payloadSchema } from "../schema";

export const monitorSchema = tbIngestPingResponse.pick({
  url: true,
  cronTimestamp: true,
});

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

const monitor = async (
  res: Response,
  monitorInfo: z.infer<typeof payloadSchema>,
  region: string,
  latency: number,
) => {
  const json = res.bodyUsed ? await res.json() : {};
  if (monitorInfo.pageId.length > 0) {
    for (const pageId of monitorInfo.pageId) {
      await publishPingResponse(tb)({
        id: nanoid(), // TBD: we don't need it
        workspaceId: monitorInfo.workspaceId,
        pageId: pageId,
        monitorId: monitorInfo.monitorId,
        timestamp: Date.now(),
        statusCode: res.status,
        latency,
        url: monitorInfo.url,
        region,
        cronTimestamp: monitorInfo.cronTimestamp || Date.now(), // TBC: why did we have this?
        metadata: JSON.stringify({ body: json }),
      });
    }
  } else {
    await publishPingResponse(tb)({
      id: nanoid(), // TBD: we don't need it
      workspaceId: monitorInfo.workspaceId,
      pageId: "",
      monitorId: monitorInfo.monitorId,
      timestamp: Date.now(),
      statusCode: res.status,
      latency,
      url: monitorInfo.url,
      region,
      cronTimestamp: monitorInfo.cronTimestamp,
      metadata: JSON.stringify({ body: json }),
    });
  }
};

export const checker = async (request: Request, region: string) => {
  const r = new Receiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
  });

  const jsonData = await request.json();

  const isValid = r.verify({
    signature: request?.headers?.get("Upstash-Signature") || "",
    body: JSON.stringify(jsonData),
  });
  if (!isValid) {
    throw new Error("Could not parse request");
  }

  const result = payloadSchema.safeParse(jsonData);

  if (!result.success) {
    throw new Error("Invalid response body");
  }

  const startTime = Date.now();
  const res = await fetch(result.data.url, { cache: "no-store" });
  const endTime = Date.now();
  const latency = endTime - startTime;

  await monitor(res, result.data, region, latency);
};
