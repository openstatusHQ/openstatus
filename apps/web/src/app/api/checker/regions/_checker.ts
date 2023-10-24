import { Receiver } from "@upstash/qstash";
import { nanoid } from "nanoid";
import type { z } from "zod";

import { db, eq, schema } from "@openstatus/db";
import { selectNotificationSchema } from "@openstatus/db/src/schema";
import {
  publishPingResponse,
  tbIngestPingResponse,
  Tinybird,
} from "@openstatus/tinybird";

import { env } from "@/env";
import type { Payload } from "../schema";
import { payloadSchema } from "../schema";
import { providerToFunction } from "../utils";

export const monitorSchema = tbIngestPingResponse.pick({
  url: true,
  cronTimestamp: true,
});

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

const monitor = async (
  payload: Payload,
  statusCode: number,
  region: string,
  latency: number,
) => {
  const { monitorId, cronTimestamp, url, workspaceId } = payload;

  await publishPingResponse({
    id: nanoid(), // TBD: we don't need it
    timestamp: Date.now(),
    statusCode,
    monitorId,
    cronTimestamp,
    url,
    workspaceId,
    latency,
    region,
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

  const result = payloadSchema.safeParse(jsonData);

  if (!result.success) {
    console.error(result.error);
    throw new Error("Invalid response body");
  }

  try {
    const startTime = performance.now();
    const res = await ping(result.data);
    const endTime = performance.now();
    const latency = endTime - startTime;
    await monitor(result.data, res.status, region, latency);
    if (res.ok) {
      if (result.data?.status === "error") {
        await updateMonitorStatus({
          monitorId: result.data.monitorId,
          status: "active",
        });
      }
    }
    if (!res.ok) {
      if (result.data?.status !== "error") {
        await triggerAlerting({ monitorId: result.data.monitorId });
        await updateMonitorStatus({
          monitorId: result.data.monitorId,
          status: "error",
        });
      }
    }
  } catch (e) {
    console.error(e);
    // if on the third retry we still get an error, we should report it
    if (request.headers.get("Upstash-Retried") === "2") {
      await monitor(result.data, 500, region, -1);
      if (result.data?.status !== "error") {
        await triggerAlerting({ monitorId: result.data.monitorId });
        await updateMonitorStatus({
          monitorId: result.data.monitorId,
          status: "error",
        });
      }
      // Here we do the alerting}
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
    ...(data.method !== "GET" &&
      data.method !== "HEAD" && { body: data?.body }),
  });

  return res;
};

const triggerAlerting = async ({ monitorId }: { monitorId: string }) => {
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

const updateMonitorStatus = async ({
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
