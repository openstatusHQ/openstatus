import { getLogger } from "@logtape/logtape";
import { sendMonitorSlaMissed } from "@openstatus/emails";
import {
  claimMonitorSlaMissNotices,
  type SealMonitorSlaMonthsResult,
  sealMonitorSlaMonths,
} from "@openstatus/services/monitor-reporting";

import { env } from "../env";

const logger = getLogger(["workflow", "monitor-sla-seal"]);

export async function runMonitorSlaSealTick(
  options: Parameters<typeof sealMonitorSlaMonths>[0] & {
    send?: typeof sendMonitorSlaMissed;
    dashboardUrl?: string;
  } = {},
): Promise<SealMonitorSlaMonthsResult & { notified: number }> {
  const { send = sendMonitorSlaMissed, dashboardUrl, ...sealOptions } = options;
  const res = await sealMonitorSlaMonths(sealOptions);
  let notified = 0;
  if (res.skipped === null) {
    const baseUrl = dashboardUrl ?? env().DASHBOARD_URL;
    // Claimed before sending: a failed send is lost rather than sent twice.
    const notices = await claimMonitorSlaMissNotices({
      db: sealOptions.db,
      month: res.month,
      now: sealOptions.now,
      policyIds: sealOptions.policyIds,
      unavailablePolicyIds: res.unavailablePolicyIds,
    });
    for (const notice of notices) {
      try {
        const id = await send({
          to: notice.to,
          idempotencyKey: `monitor-sla-miss:${notice.policy.id}:${notice.month}`,
          policyName: notice.policy.name,
          month: notice.month,
          workspaceName: notice.workspaceName,
          monitors: notice.monitors,
          url: `${baseUrl}/reportings/monitors/${notice.policy.id}`,
        });
        if (id) notified++;
      } catch (err) {
        logger.error(
          "monitor-sla-seal: miss email for policy {policyId} failed: {err}",
          { policyId: notice.policy.id, err: String(err) },
        );
      }
    }
  }
  logger.info(
    "monitor-sla-seal complete: month={month} sealed={sealed} unavailable={unavailable} notified={notified} skipped={skipped}",
    {
      month: res.month,
      sealed: res.sealed,
      unavailable: res.unavailable,
      notified,
      skipped: res.skipped ?? "no",
    },
  );
  return { ...res, notified };
}
