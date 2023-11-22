import { Tinybird } from "@chronark/zod-bird";

import { AuditLog } from "./client";

const tb = new Tinybird({ token: process.env.TINY_BIRD_API_KEY || "" });

const auditLog = new AuditLog({ tb });

async function seed() {
  await auditLog.publishAuditLog({
    id: "monitor:1",
    action: "monitor.failed",
    metadata: { region: "gru", statusCode: 500, message: "timeout" },
  });
}

async function history() {
  return await auditLog.getAuditLog({ event_id: "monitor:1" });
}

// seed();
// const all = await history();
// const first = all.data[0];

// if (first.action === "monitor.down") {
//   first.metadata.region;
// }

// ========

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
