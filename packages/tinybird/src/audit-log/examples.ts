import { Tinybird } from "@chronark/zod-bird";

import { getAuditLog, publishAuditLog } from "./client";

const tb = new Tinybird({ token: process.env.TINY_BIRD_API_KEY || "" });

async function seed() {
  await publishAuditLog(tb)({
    id: "monitor:1",
    action: "monitor.down",
    timestamp: Date.now(),
    metadata: { region: "gru" },
  });
  await wait(1000);
  await publishAuditLog(tb)({
    id: "monitor:1",
    action: "monitor.up",
    timestamp: Date.now(),
    metadata: { region: "gru" },
  });
}

async function history() {
  return await getAuditLog(tb)({
    event_id: "monitor:1",
  });
}

// seed();
// await history();

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
