import { getLogger } from "@logtape/logtape";
import { sendIncidentTargetNotice } from "@openstatus/emails";
import {
  emailIncidentTargetNotices,
  type ReminderResult,
  recordIncidentTargetBreaches,
  remindStaleIncidents,
  sendIncidentTargetNotices,
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

/** Records target misses and sends target notices, by Slack or by email when Slack cannot. */
async function runIncidentTargetPhase(): Promise<void> {
  const breaches = await recordIncidentTargetBreaches();
  if (breaches.length > 0) {
    logger.info("incident target misses recorded: {breaches}", {
      breaches: breaches.length,
    });
  }

  const dashboardUrl = env().DASHBOARD_URL;
  const notices = await sendIncidentTargetNotices({
    breaches,
    clientFor,
    dashboardUrl,
  });
  if (notices.length > 0) {
    logger.info(
      "incident target notices sent: {sent}, retrying: {retry}, undelivered: {undelivered}",
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
  const emailed = await emailIncidentTargetNotices({
    notices,
    send: sendIncidentTargetNotice,
    dashboardUrl,
  });
  if (emailed.length > 0) {
    logger.info(
      "incident target notice emails sent: {sent}, skipped: {skipped}, no recipients: {no_recipients}, failed: {failed}",
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

/** Runs the target phase, then the stale reminders, which a target failure must not skip. */
export async function runIncidentTargetAndRemindersTick(
  phases: {
    targets?: () => Promise<void>;
    reminders?: () => Promise<ReminderResult[]>;
  } = {},
): Promise<ReminderResult[]> {
  const { targets = runIncidentTargetPhase, reminders = runStaleReminders } =
    phases;
  try {
    await targets();
  } catch (err) {
    logger.error("incident target phase failed: {err}", { err: String(err) });
  }
  return reminders();
}
