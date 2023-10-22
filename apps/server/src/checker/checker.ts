import { updateMonitorStatus } from "./alerting";
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
    console.log("try publish ping to tb - attempt 1 ", JSON.stringify(payload));
    await publishPing({ payload, statusCode, latency });
  } catch {
    try {
      console.log(
        "try publish ping to tb - attempt 2 ",
        JSON.stringify(payload),
      );
      await publishPing({ payload, statusCode, latency });
    } catch (e) {
      throw e;
    }
  }
  console.log("successfully publish ping to tb ", JSON.stringify(payload));
};

const run = async (data: Payload, retry?: number | undefined) => {
  const startTime = Date.now();
  const res = await pingEndpoint(data);
  const endTime = Date.now();
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
    // Store the error on third task retry
    if (retry === 3) {
      await publishPingRetryPolicy({
        payload: data,
        latency,
        statusCode: res.status,
      });
      if (data?.status === "active") {
        await updateMonitorStatus({
          monitorId: data.monitorId,
          status: "error",
        });
      }
      // The response was not ok and we should throw an error
      throw new Error(
        `error ping endpoint for ${data.monitorId} on ${retry} retry`,
      );
    }
  }
  return { res, latency };
};

export const checkerRetryPolicy = async (data: Payload, retry = 0) => {
  try {
    console.log("try run checker - attempt 1 ", JSON.stringify(data));
    await run(data, retry);
  } catch {
    try {
      console.log("try run checker - attempt 2 ", JSON.stringify(data));
      await run(data, retry);
    } catch (e) {
      throw e;
    }
  }
  console.log("successfully run checker ", JSON.stringify(data));
};
