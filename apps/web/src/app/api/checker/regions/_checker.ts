import { Receiver } from "@upstash/qstash/cloudflare";
import { nanoid } from "nanoid";
import type { z } from "zod";

import { db, eq, schema } from "@openstatus/db";
import {
  publishPingResponse,
  tbIngestPingResponse,
  Tinybird,
} from "@openstatus/tinybird";

import { env } from "@/env";
import type { Payload } from "../schema";
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

  try {
    const startTime = Date.now();
    const res = await ping(result.data);
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
      // Here we do the alerting
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

const triggerAlerting = async ({ monitorId }: { monitorId: string }) => {
  const notifications = await db
    .select()
    .from(schema.notificationsToMonitors)
    .leftJoin(
      schema.notification,
      eq(schema.notification.id, schema.notificationsToMonitors.notificationId),
    )
    .leftJoin(
      schema.monitor,
      eq(schema.monitor.id, schema.notificationsToMonitors.monitorId),
    )
    .where(eq(schema.monitor.id, Number(monitorId)))
    .all();

  for (const notif of notifications) {
    // Send the appropriate notification
  }
};
