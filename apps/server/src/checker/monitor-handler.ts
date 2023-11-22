import { env } from "../env";
import { checkerAudit } from "../utils/audit-log";
import { triggerAlerting, upsertMonitorStatus } from "./alerting";
import type { Payload } from "./schema";

export async function handleMonitorRecovered(data: Payload, res: Response) {
  await upsertMonitorStatus({
    monitorId: data.monitorId,
    status: "active",
  });
  // ALPHA
  await checkerAudit.publishAuditLog({
    id: `monitor:${data.monitorId}`,
    action: "monitor.recovered",
    metadata: { region: env.FLY_REGION, statusCode: res.status },
  });
  //
}

export async function handleMonitorFailed(
  data: Payload,
  res: Response | null,
  message?: string,
) {
  // ALPHA
  await checkerAudit.publishAuditLog({
    id: `monitor:${data.monitorId}`,
    action: "monitor.failed",
    metadata: {
      region: env.FLY_REGION,
      statusCode: res?.status,
      message,
    },
  });
  //
  await upsertMonitorStatus({
    monitorId: data.monitorId,
    status: "error",
  });
  await triggerAlerting({
    monitorId: data.monitorId,
    region: env.FLY_REGION,
    statusCode: res?.status,
    message,
  });
}
