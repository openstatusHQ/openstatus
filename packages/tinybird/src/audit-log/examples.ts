import { Tinybird } from "@chronark/zod-bird";
import { z } from "zod";

import { AuditLog } from "./client";

const tb = new Tinybird({ token: process.env.TINY_BIRD_API_KEY || "" });
const metadataSchema = z.object({ region: z.string() });
const name = "audit_log__v0";

const auditLog = new AuditLog({ tb, name, metadataSchema });

async function seed() {
  await auditLog.publishAuditLog({
    id: "monitor:1",
    action: "monitor.down",
    metadata: { region: "gru" },
  });
}

async function history() {
  return await auditLog.getAuditLog({ event_id: "monitor:1" });
}

seed();
// const all = await history();
// console.log(all);

// ========

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
