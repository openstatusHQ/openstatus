import { Receiver } from "@upstash/qstash";
import { Hono } from "hono";

import { checker, monitor, triggerAlerting, updateMonitorStatus } from "./checker";
import { payloadSchema } from "./schema";

export const checkerRoute = new Hono();

checkerRoute.post("/checker", async (c) => {
  const r = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
  });

  const jsonData = await c.req.json();

  const isValid = r.verify({
    signature: c.req.header("Upstash-Signature") || "",
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
    checker(result.data);
  } catch (e) {
    console.error(e);
    // if on the third retry we still get an error, we should report it
    if (c.req.header("Upstash-Retried") === "2") {
      await monitor(
        { status: 500, text: () => Promise.resolve(`${e}`) },
        result.data,
        -1,
      );
      if (result.data?.status !== "error") {
        await triggerAlerting({ monitorId: result.data.monitorId });
        await updateMonitorStatus({
          monitorId: result.data.monitorId,
          status: "error",
        });
      }
    }
  }
});
