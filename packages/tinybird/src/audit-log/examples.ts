// import { Tinybird } from "@chronark/zod-bird";

// import { AuditLog } from "./client";

// Commented out as not used to avoid biome-ignore
// const tb = new Tinybird({ token: process.env.TINY_BIRD_API_KEY || "" });

// Commented out as not used to avoid biome-ignore
// const auditLog = new AuditLog({ tb });

// Commented out as not used to avoid biome-ignore
// async function seed() {
//   await auditLog.publishAuditLog({
//     id: "monitor:2",
//     action: "monitor.failed",
//     targets: [{ id: "2", type: "monitor" }],
//     metadata: { region: "gru", statusCode: 500, message: "timeout" },
//   });
//   await auditLog.publishAuditLog({
//     id: "monitor:1",
//     action: "monitor.recovered",
//     targets: [{ id: "1", type: "monitor" }],
//     metadata: { region: "gru", statusCode: 200 },
//   });
//   await auditLog.publishAuditLog({
//     id: "user:1",
//     actor: {
//       type: "user",
//       id: "1",
//     },
//     targets: [{ id: "1", type: "user" }],
//     action: "notification.sent",
//     metadata: { provider: "email" },
//   });
// }

// Commented out as not used to avoid biome-ignore
// async function history() {
//   return await auditLog.getAuditLog({ event_id: "user:1" });
// }

// seed();
// const all = await history();
// console.log(all);
// const first = all.data[0];

// if (first.action === "monitor.failed") {
//   first.metadata.message;
// }
