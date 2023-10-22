import { nanoid } from "nanoid";

import { publishPingResponse } from "@openstatus/tinybird";

import { env } from "../env";
import { fakePromiseWithRandomResolve } from "../utils/random-promise";
import type { Payload } from "./schema";

const region = env.FLY_REGION;

function getHeaders(data?: Payload) {
  const customHeaders =
    data?.headers?.reduce((o, v) => {
      // removes empty keys from the header
      if (v.key.trim() === "") return o;
      return { ...o, [v.key]: v.value };
    }, {}) || {};
  return {
    "OpenStatus-Ping": "true",
    ...customHeaders,
  };
}

export async function pingEndpoint(data: Payload) {
  try {
    const res = await fetch(data?.url, {
      method: data?.method,
      cache: "no-store",
      headers: getHeaders(data),
      // Avoid having "TypeError: Request with a GET or HEAD method cannot have a body." error
      ...(data.method === "POST" && { body: data?.body }),
    });

    return res;
  } catch (e) {
    throw e;
  }
}

export type PublishPingType = {
  payload: Payload;
  statusCode: number;
  latency: number;
};

export async function publishPing({
  payload,
  statusCode,
  latency,
}: PublishPingType) {
  const { monitorId, cronTimestamp, url, workspaceId } = payload;

  if (process.env.NODE_ENV === "production") {
    const res = await publishPingResponse({
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
    if (res.successful_rows === 0) {
      throw new Error(`error 0 rows on publish ping for ${payload.monitorId}`);
    }
    return res;
  }

  const res = await fakePromiseWithRandomResolve();
  return res;
}
