import { getLogger } from "@logtape/logtape";
import { sendIncidentSlaNotice } from "@openstatus/emails";
import {
  emailIncidentSlaNotices,
  type ReminderResult,
  recordIncidentMissedUpdates,
  recordIncidentSlaBreaches,
  remindStaleIncidents,
  sendIncidentSlaNotices,
} from "@openstatus/services/incident";
import { Redis } from "@openstatus/upstash";
import { WebClient } from "@slack/web-api";

import { env } from "../env";

const logger = getLogger(["workflow", "incident-reminders"]);

let redis: ReturnType<typeof Redis.fromEnv> | undefined;

function countBy<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const key = keyOf(item);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

/** Records SLA misses, sends SLA notices (email when Slack cannot), then stale reminders. */
export async function runIncidentSlaAndRemindersTick(): Promise<
  ReminderResult[]
> {
  const breaches = await recordIncidentSlaBreaches();
  const missedUpdates = await recordIncidentMissedUpdates();
  if (breaches.length + missedUpdates.length > 0) {
    logger.info(
      "incident sla misses recorded: {breaches}, missed updates: {updates}",
      { breaches: breaches.length, updates: missedUpdates.length },
    );
  }

  // Default retries can hold the tick for ~30 min; a released claim retries
  // on the next tick instead.
  const clientFor = (token: string) =>
    new WebClient(token, { retryConfig: { retries: 2 } });
  const dashboardUrl = env().DASHBOARD_URL;

  const notices = await sendIncidentSlaNotices({
    breaches,
    missedUpdates,
    clientFor,
    dashboardUrl,
  });
  if (notices.length > 0) {
    logger.info(
      "incident sla notices sent: {sent}, retrying: {retry}, undelivered: {undelivered}",
      {
        sent: 0,
        retry: 0,
        undelivered: 0,
        ...countBy(notices, (n) =>
          n.outcome === "sent" || n.outcome === "retry"
            ? n.outcome
            : "undelivered",
        ),
      },
    );
  }
  const emailed = await emailIncidentSlaNotices({
    notices,
    send: sendIncidentSlaNotice,
    dashboardUrl,
  });
  if (emailed.length > 0) {
    logger.info(
      "incident sla notice emails sent: {sent}, no recipients: {no_recipients}, failed: {failed}",
      {
        sent: 0,
        no_recipients: 0,
        failed: 0,
        ...countBy(emailed, (e) => e.outcome),
      },
    );
  }

  redis ??= Redis.fromEnv();
  const client = redis;
  const results = await remindStaleIncidents({
    clientFor,
    claim: async (key, ttlSeconds) =>
      (await client.set(key, "1", { nx: true, ex: ttlSeconds })) !== null,
    release: async (key) => {
      await client.del(key);
    },
    dashboardUrl,
  });
  logger.info(
    "incident reminders sent: {sent}, failed: {failed}, skipped: {skipped}",
    {
      sent: 0,
      failed: 0,
      skipped: 0,
      ...countBy(results, (r) =>
        r.target === null ? "skipped" : r.sent ? "sent" : "failed",
      ),
    },
  );
  return results;
}
