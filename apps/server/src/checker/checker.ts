import { env } from "../env";
import { triggerAlerting, updateMonitorStatus } from "./alerting";
import type { PublishPingType } from "./ping";
import { pingEndpoint, publishPing } from "./ping";
import type { Payload } from "./schema";

// we could have a 'retry' parameter to know how often we should retry
// we could use a setTimeout to retry after a certain amount of time - can be random between 500ms and 10s
export const publishPingRetryPolicy = async ({
  payload,
  latency,
  statusCode,
}: PublishPingType) => {
  try {
    console.log(
      `1️⃣ try publish ping to tb - attempt 1  ${JSON.stringify(
        payload,
      )}  with latency ${latency} and status code ${statusCode}`,
    );
    await publishPing({ payload, statusCode, latency });
  } catch {
    try {
      console.log(
        "2️⃣ try publish ping to tb - attempt 2 ",
        JSON.stringify(payload),
      );
      await publishPing({ payload, statusCode, latency });
    } catch (e) {
      throw e;
    }
  }
  console.log(
    `🗃️ Successfully published ${JSON.stringify(
      payload,
    )}  with latency ${latency} and status code ${statusCode}`,
  );
};

const run = async (data: Payload, retry?: number | undefined) => {
  let startTime = 0;
  let endTime = 0;
  let res = null;
  // We are doing these for wrong urls
  try {
    startTime = Date.now();
    res = await pingEndpoint(data);
    endTime = Date.now();
  } catch (e) {
    console.log("error on pingEndpoint", e);
    endTime = Date.now();
  }

  const latency = endTime - startTime;
  if (res?.ok) {
    await publishPingRetryPolicy({
      payload: data,
      latency,
      statusCode: res.status,
    });
    if (data?.status === "error") {
      await updateMonitorStatus({
        monitorId: data.monitorId,
        status: "active",
      });
    }
  } else {
    if (retry === 0) {
      throw new Error(`error on ping for ${data.monitorId}`);
    }
    // Store the error on third task retry
    if (retry === 1) {
      console.info(
        `🐛 error on fetching data for ${JSON.stringify(
          data,
        )}  with result ${JSON.stringify(res)}`,
      );
      await publishPingRetryPolicy({
        payload: data,
        latency,
        statusCode: res?.status || 0,
      });
      if (data?.status === "active") {
        await updateMonitorStatus({
          monitorId: data.monitorId,
          status: "error",
        });
        await triggerAlerting({
          monitorId: data.monitorId,
          region: env.FLY_REGION,
          statusCode: res?.status || 0,
        });
      }
    }
  }
  return { res, latency };
};

export const checkerRetryPolicy = async (data: Payload, retry = 0) => {
  try {
    console.log("🥇 try run checker - attempt 1 ", JSON.stringify(data));
    await run(data, 0);
  } catch {
    try {
      console.log("🥈 try run checker - attempt 2 ", JSON.stringify(data));
      await run(data, 1);
    } catch (e) {
      throw e;
    }
  }
  console.log("🔥 successfully run checker ", JSON.stringify(data));
};
