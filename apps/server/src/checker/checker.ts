import { nanoid } from "nanoid";
import type { z } from "zod";

import { db, eq, schema } from "@openstatus/db";
import { selectNotificationSchema } from "@openstatus/db/src/schema";
import {
  publishPingResponse,
  tbIngestPingResponse,
  Tinybird,
} from "@openstatus/tinybird";

import type { Payload, payloadSchema } from "./schema";
import { providerToFunction } from "./utils";

export const monitorSchema = tbIngestPingResponse.pick({
  url: true,
  cronTimestamp: true,
});

const tb = new Tinybird({ token: process.env.TINY_BIRD_API_KEY || "" });

export const monitor = async (
  res: { text: () => Promise<string>; status: number },
  monitorInfo: z.infer<typeof payloadSchema>,
  latency: number,
) => {
  const region = process.env.FLY_REGION || "";
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

export const checker = async (data: z.infer<typeof payloadSchema>) => {
  const startTime = Date.now();
  const res = await ping(data);
  const endTime = Date.now();
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

export const triggerAlerting = async ({ monitorId }: { monitorId: string }) => {
  const notifications = await db
    .select()
    .from(schema.notificationsToMonitors)
    .innerJoin(
      schema.notification,
      eq(schema.notification.id, schema.notificationsToMonitors.notificationId),
    )
    .innerJoin(
      schema.monitor,
      eq(schema.monitor.id, schema.notificationsToMonitors.monitorId),
    )
    .where(eq(schema.monitor.id, Number(monitorId)))
    .all();
  for (const notif of notifications) {
    await providerToFunction[notif.notification.provider]({
      monitor: notif.monitor,
      notification: selectNotificationSchema.parse(notif.notification),
    });
  }
};

export const updateMonitorStatus = async ({
  monitorId,
  status,
}: {
  monitorId: string;
  status: z.infer<typeof schema.statusSchema>;
}) => {
  await db
    .update(schema.monitor)
    .set({ status })
    .where(eq(schema.monitor.id, Number(monitorId)))
    .run();
};
