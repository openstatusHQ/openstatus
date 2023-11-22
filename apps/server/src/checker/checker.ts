import { handleMonitorFailed, handleMonitorRecovered } from "./monitor-handler";
import type { PublishPingType } from "./ping";
import { pingEndpoint, publishPing } from "./ping";
import type { Payload } from "./schema";

// we could have a 'retry' parameter to know how often we should retry
// we could use a setTimeout to retry after a certain amount of time - can be random between 500ms and 10s
export const publishPingRetryPolicy = async ({
  payload,
  latency,
  statusCode,
  message,
}: PublishPingType) => {
  try {
    console.log(
      `1️⃣ try publish ping to tb - attempt 1  ${JSON.stringify(
        payload,
      )}  with latency ${latency} and status code ${statusCode}`,
    );
    await publishPing({
      payload,
      statusCode,
      latency,
      message,
    });
  } catch {
    try {
      console.log(
        "2️⃣ try publish ping to tb - attempt 2 ",
        JSON.stringify(payload),
      );

      await publishPing({
        payload,
        statusCode,
        latency,
        message,
      });
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

const run = async (data: Payload, retry: number) => {
  let startTime = 0;
  let endTime = 0;
  let res = null;
  let message = undefined;
  // We are doing these for wrong urls
  try {
    startTime = Date.now();
    res = await pingEndpoint(data);
    endTime = Date.now();
  } catch (e) {
    endTime = Date.now();
    message = `${e}`;
    console.log(
      `🚨 error on pingEndpoint for ${JSON.stringify(data)} error: `,
      e,
    );
  }

  const latency = endTime - startTime;
  if (res?.ok) {
    await publishPingRetryPolicy({
      payload: data,
      latency,
      statusCode: res.status,
      message: undefined,
    });
    if (data?.status === "error") {
      handleMonitorRecovered(data, res);
    }
  } else {
    if (retry < 2) {
      throw new Error(`error on ping for ${data.monitorId}`);
    }
    // Store the error on third task retry
    if (retry === 2) {
      console.log(
        `🐛 error on fetching data for ${JSON.stringify(
          data,
        )} with result ${JSON.stringify(res)}`,
      );
      await publishPingRetryPolicy({
        payload: data,
        latency,
        statusCode: res?.status,
        message,
      });
      if (data?.status === "active") {
        handleMonitorFailed(data, res, message);
      }
    }
  }
  return { res, latency };
};

// We have this extensible retry policy because sometimes we have this error :
// ConnectionClosed: The socket connection was closed unexpectedly.
export const checkerRetryPolicy = async (data: Payload) => {
  try {
    console.log("🥇 try run checker - attempt 1 ", JSON.stringify(data));
    await run(data, 0);
  } catch {
    try {
      console.log("🥈 try run checker - attempt 2 ", JSON.stringify(data));
      await run(data, 1);
    } catch (e) {
      try {
        console.log("🥉 try run checker - attempt 3 ", JSON.stringify(data));
        await run(data, 2);
      } catch (e) {
        throw e;
      }
    }
  }
  console.log("🔥 successfully run checker ", JSON.stringify(data));
};
