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

// Default retries can hold the tick for ~30 min; a released claim retries
// on the next tick instead.
const clientFor = (token: string) =>
  new WebClient(token, { retryConfig: { retries: 2 } });

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

/** Records SLA misses and sends SLA notices, by Slack or by email when Slack cannot. */
async function runIncidentSlaPhase(): Promise<void> {
  const breaches = await recordIncidentSlaBreaches();
  const missedUpdates = await recordIncidentMissedUpdates();
  if (breaches.length + missedUpdates.length > 0) {
    logger.info(
      "incident sla misses recorded: {breaches}, missed updates: {updates}",
      { breaches: breaches.length, updates: missedUpdates.length },
    );
  }

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
      "incident sla notice emails sent: {sent}, skipped: {skipped}, no recipients: {no_recipients}, failed: {failed}",
      {
        sent: 0,
        skipped: 0,
        no_recipients: 0,
        failed: 0,
        ...countBy(emailed, (e) => e.outcome),
      },
    );
  }
}

async function runStaleReminders(): Promise<ReminderResult[]> {
  redis ??= Redis.fromEnv();
  const client = redis;
  const results = await remindStaleIncidents({
    clientFor,
    claim: async (key, ttlSeconds) =>
      (await client.set(key, "1", { nx: true, ex: ttlSeconds })) !== null,
    release: async (key) => {
      await client.del(key);
    },
    dashboardUrl: env().DASHBOARD_URL,
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

/** Runs the SLA phase, then the stale reminders, which an SLA failure must not skip. */
export async function runIncidentSlaAndRemindersTick(
  phases: {
    sla?: () => Promise<void>;
    reminders?: () => Promise<ReminderResult[]>;
  } = {},
): Promise<ReminderResult[]> {
  const { sla = runIncidentSlaPhase, reminders = runStaleReminders } = phases;
  try {
    await sla();
  } catch (err) {
    logger.error("incident sla phase failed: {err}", { err: String(err) });
  }
  return reminders();
}
