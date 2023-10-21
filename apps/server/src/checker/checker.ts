import { nanoid } from "nanoid";

import { publishPingResponse } from "@openstatus/tinybird";

import { env } from "../env";
import { updateMonitorStatus } from "./alerting";
import type { Payload } from "./schema";

const region = env.FLY_REGION;

export const monitor = async ({
  monitorInfo,
  latency,
  statusCode,
}: {
  monitorInfo: Payload;
  latency: number;
  statusCode: number;
}) => {
  const { monitorId, cronTimestamp, url, workspaceId } = monitorInfo;

  console.log(
    `publishing ping response for ${url} with status ${statusCode} and latency ${latency} and monitorId ${monitorId} `,
  );
  await publishPingResponse({
    id: nanoid(), // TBD: we don't need it
    timestamp: Date.now(),
    statusCode,
    latency,
    region,
    url,
    monitorId,
    cronTimestamp,
    workspaceId,
  });
};

export const checker = async (data: Payload) => {
  const startTime = Date.now();
  const res = await ping(data);
  const endTime = Date.now();
  const latency = endTime - startTime;
  if (res?.ok) {
    await monitor({ monitorInfo: data, latency, statusCode: res.status });
    if (data?.status === "error") {
      await updateMonitorStatus({
        monitorId: data.monitorId,
        status: "active",
      });
    }
  } else {
    console.log(`first retry for ${data.url} with status ${res?.status}`);
    const startTime = Date.now();
    const retry = await ping(data);
    const endTime = Date.now();
    const latency = endTime - startTime;
    if (retry?.ok) {
      await monitor({ monitorInfo: data, latency, statusCode: retry.status });
      if (data?.status === "error") {
        await updateMonitorStatus({
          monitorId: data.monitorId,
          status: "active",
        });
      }
    } else {
      console.log(`error for ${data} with info ${JSON.stringify(retry)}`);
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

  try {
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
  } catch (e) {
    console.log("fetch error for : ", JSON.stringify(data));
    console.log(e);
  }
};
