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
    `publishing ping response for ${JSON.stringify(
      monitorInfo,
    )} with latency ${latency}`,
  );
  try {
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
      console.log(
        `first error publishing ping response for ${JSON.stringify(
          monitorInfo,
        )} with res ${JSON.stringify(res)}`,
      );
      const secondRetry = await publishPingResponse({
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
      if (secondRetry.successful_rows === 0) {
        throw new Error("error publishing ping response");
      }
    }
  } catch (e) {
    console.error(e);
    console.log(
      `error publishing ping response for ${JSON.stringify(
        monitorInfo,
      )} with error ${e}  )`,
    );
    throw e;
  }
};

export const checker = async (data: Payload, retryCount: number) => {
  const startTime = Date.now();
  const res = await ping(data);
  const endTime = Date.now();
  const latency = endTime - startTime;
  console.log(
    `first try for ${JSON.stringify(data)} with result ${JSON.stringify(res)}`,
  );
  if (res?.ok) {
    await monitor({ monitorInfo: data, latency, statusCode: res.status });
    if (data?.status === "error") {
      await updateMonitorStatus({
        monitorId: data.monitorId,
        status: "active",
      });
    }
  } else {
    console.log(
      `first retry for ${JSON.stringify(data)} with result ${JSON.stringify(
        res,
      )}`,
    );
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
      // We do a third retry before we save the error
      // if at the third retry we have a reponse we should save it
      if (retryCount === 3 && retry) {
        await monitor({
          monitorInfo: data,
          latency,
          statusCode: retry.status,
        });
        if (data?.status === "active") {
          await updateMonitorStatus({
            monitorId: data.monitorId,
            status: "error",
          });
        }
      } else {
        console.log(
          `Could not ping ${JSON.stringify(data)} with retry ${retry}`,
        );
        // To make sure we retry the task
        throw new Error(
          `error for ${JSON.stringify(data)} with info ${JSON.stringify(
            retry,
          )}`,
        );
      }
      console.log(
        `error for ${JSON.stringify(data)} with info ${JSON.stringify(retry)}`,
      );
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
      // See https://github.com/oven-sh/bun/issues/3327
      keepalive: false,
      headers: {
        "OpenStatus-Ping": "true",
        ...headers,
      },
      // Avoid having "TypeError: Request with a GET or HEAD method cannot have a body." error
      ...(data.method === "POST" && { body: data?.body }),
    });

    return res;
  } catch (e) {
    console.log(`fetch error for : ${JSON.stringify(data)} with error ${e}`);
    throw e;
  }
};
