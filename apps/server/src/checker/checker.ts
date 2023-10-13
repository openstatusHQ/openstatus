import { nanoid } from "nanoid";
import type { z } from "zod";

import {
  publishPingResponse,
  tbIngestPingResponse,
  Tinybird,
} from "@openstatus/tinybird";

import { env } from "../env";
import { updateMonitorStatus } from "./alerting";
import type { Payload, payloadSchema } from "./schema";

export const monitorSchema = tbIngestPingResponse.pick({
  url: true,
  cronTimestamp: true,
});

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

const region = env.FLY_REGION;

export const monitor = async (
  res: { text: () => Promise<string>; status: number },
  monitorInfo: z.infer<typeof payloadSchema>,
  latency: number,
) => {
  const text = (await res.text()) || "";
  if (monitorInfo.pageIds.length > 0) {
    for (const pageId of monitorInfo.pageIds) {
      const { pageIds, ...rest } = monitorInfo;
      await publishPingResponse(tb)({
        ...rest,
        id: nanoid(), // TBD: we don't need it
        pageId: pageId, // TODO: delete
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
      pageId: "", // TODO: delete
      timestamp: Date.now(),
      statusCode: res.status,
      latency,
      region,
      metadata: JSON.stringify({ text }),
    });
  }
};

export const checker = async (data: z.infer<typeof payloadSchema>) => {
  const startTime = performance.now();
  const res = await ping(data);
  const endTime = performance.now();
  const latency = endTime - startTime;
  await monitor(res, data, latency);
  if (res.ok) {
    if (data?.status === "error") {
      await updateMonitorStatus({
        monitorId: data.monitorId,
        status: "active",
      });
    }
  }
  if (!res.ok) {
    if (data?.status === "active") {
      await updateMonitorStatus({
        monitorId: data.monitorId,
        status: "error",
      });
    }
  }
};

export const ping = async (
  data: Pick<Payload, "headers" | "body" | "method" | "url">,
) => {
  const headers =
    data?.headers?.reduce((o, v) => {
      if (v.key.trim() === "") return o; // removes empty keys from the header
      return { ...o, [v.key]: v.value };
    }, {}) || {};

  const res = await fetch(data?.url, {
    method: data?.method,
    cache: "no-store",
    headers: {
      "OpenStatus-Ping": "true",
      ...headers,
    },
    // Avoid having "TypeError: Request with a GET or HEAD method cannot have a body." error
    ...(data.method !== "GET" && { body: data?.body }),
  });

  return res;
};
