import { getLogger } from "@logtape/logtape";
import { sendUptimeTargetMissed } from "@openstatus/emails";
import {
  claimUptimeTargetMissNotices,
  releaseUptimeTargetMissNotice,
  type SealUptimeTargetMonthsResult,
  type SealMonitorUptimeResult,
  sealUptimeTargetMonths,
  sealMonitorUptime,
} from "@openstatus/services/uptime-target";

import { env } from "../env";

const logger = getLogger(["workflow", "uptime-target-seal"]);

export async function runUptimeTargetSealTick(
  options: Parameters<typeof sealUptimeTargetMonths>[0] &
    Parameters<typeof sealMonitorUptime>[0] & {
      send?: typeof sendUptimeTargetMissed;
      dashboardUrl?: string;
    } = {},
): Promise<
  SealUptimeTargetMonthsResult & {
    notified: number;
    uptime: SealMonitorUptimeResult;
  }
> {
  const {
    send = sendUptimeTargetMissed,
    dashboardUrl,
    monitorIds,
    episodesPipes,
    sleep,
    ...sealOptions
  } = options;
  // first: a month seals from what this stored
  const uptime = await sealMonitorUptime({
    db: sealOptions.db,
    now: sealOptions.now,
    monitorIds,
    episodesPipes,
    sleep,
  });
  logger.info(
    "monitor-uptime-seal complete: sealed={sealed} failed={failed} skipped={skipped}",
    uptime,
  );
  const res = await sealUptimeTargetMonths(sealOptions);
  let notified = 0;
  if (res.skipped === null) {
    const baseUrl = dashboardUrl ?? env().DASHBOARD_URL;
    // Claimed before sending so overlapping runs send once; a failed send releases its claim.
    const notices = await claimUptimeTargetMissNotices({
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
          idempotencyKey: `uptime-target-miss:${notice.policy.id}:${notice.month}`,
          policyName: notice.policy.name,
          month: notice.month,
          workspaceName: notice.workspaceName,
          monitors: notice.monitors,
          url: `${baseUrl}/uptime-targets/${notice.policy.id}/overview`,
        });
        if (id) notified++;
      } catch (err) {
        logger.error(
          "uptime-target-seal: miss email for policy {policyId} failed: {err}",
          { policyId: notice.policy.id, err: String(err) },
        );
        await releaseUptimeTargetMissNotice({
          db: sealOptions.db,
          policyId: notice.policy.id,
          month: notice.month,
        }).catch((releaseErr) =>
          logger.error(
            "uptime-target-seal: release of miss notice for policy {policyId} failed: {err}",
            { policyId: notice.policy.id, err: String(releaseErr) },
          ),
        );
      }
    }
  }
  logger.info(
    "uptime-target-seal complete: month={month} sealed={sealed} unavailable={unavailable} notified={notified} skipped={skipped}",
    {
      month: res.month,
      sealed: res.sealed,
      unavailable: res.unavailable,
      notified,
      skipped: res.skipped ?? "no",
    },
  );
  return { ...res, notified, uptime };
}
