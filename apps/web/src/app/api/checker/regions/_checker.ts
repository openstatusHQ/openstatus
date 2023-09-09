import { Receiver } from "@upstash/qstash";
import { nanoid } from "nanoid";
import type { z } from "zod";

import {
  publishPingResponse,
  tbIngestPingResponse,
  Tinybird,
} from "@openstatus/tinybird";

import { env } from "@/env";
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
    console.error(result.error);
    throw new Error("Invalid response body");
  }

  const headers =
    result.data?.headers?.reduce((o, v) => ({ ...o, [v.key]: v.value }), {}) ||
    {};

  try {
    const startTime = Date.now();
    const res = await fetch(result.data?.url, {
      method: result.data?.method,
      cache: "no-store",
      headers: {
        "OpenStatus-Ping": "true",
        ...headers,
      },
      // Avoid having "TypeError: Request with a GET or HEAD method cannot have a body." error
      ...(result.data.method !== "GET" && { body: result.data?.body }),
    });

    const endTime = Date.now();
    const latency = endTime - startTime;
    await monitor(res, result.data, region, latency);
  } catch (e) {
    console.error(e);
    // if on the third retry we still get an error, we should report it
    if (request.headers.get("Upstash-Retried") === "2") {
      await monitor(
        { status: 500, text: () => Promise.resolve(`${e}`) },
        result.data,
        region,
        -1,
      );
    }
  }
};
