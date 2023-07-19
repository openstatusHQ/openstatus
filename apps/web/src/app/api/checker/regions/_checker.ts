import { Receiver } from "@upstash/qstash/cloudflare";
import { nanoid } from "nanoid";
import { z } from "zod";

import {
  publishPingResponse,
  tbIngestPingResponse,
  Tinybird,
} from "@openstatus/tinybird";

import { env } from "@/env.mjs";

export const monitorSchema = tbIngestPingResponse.pick({
  url: true,
  cronTimestamp: true,
});

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

const monitor = async (
  res: Response,
  {
    latency,
    url,
    region,
    cronTimestamp,
  }: { latency: number; url: string; region: string; cronTimestamp: number },
) => {
  await publishPingResponse(tb)({
    id: nanoid(),
    workspaceId: "openstatus",
    pageId: "openstatus",
    monitorId: "openstatusPing",
    timestamp: Date.now(),
    statusCode: res.status,
    latency,
    url,
    region,
    cronTimestamp,
    // TODO: discuss how to use the metadata properly
    // metadata: {
    //   status: res.status,
    //   statusText: res.statusText,
    //   ok: res.ok,
    //   headers: res.headers,
    //   // body: res.body ? JSON.parse(res.body),
    //   bodyUsed: res.bodyUsed,
    //   redirected: res.redirected,
    //   type: res.type,
    // },
  });
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

  const result = monitorSchema.safeParse(jsonData);

  if (!result.success) {
    throw new Error("Invalid response body");
  }

  const { url, cronTimestamp } = result.data;

  const startTime = Date.now();
  const res = await fetch(url, { cache: "no-store" });
  const endTime = Date.now();
  const latency = endTime - startTime;

  await monitor(res, {
    latency,
    url,
    region,
    cronTimestamp: cronTimestamp || Date.now(), // HOT FIXME: remove!
  });
};
