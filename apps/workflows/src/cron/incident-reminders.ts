import { getLogger } from "@logtape/logtape";
import {
  type ReminderResult,
  remindStaleIncidents,
} from "@openstatus/services/incident";
import { Redis } from "@openstatus/upstash";
import { WebClient } from "@slack/web-api";

import { env } from "../env";

const logger = getLogger(["workflow", "incident-reminders"]);

let redis: ReturnType<typeof Redis.fromEnv> | undefined;

export async function runIncidentRemindersTick(): Promise<ReminderResult[]> {
  redis ??= Redis.fromEnv();
  const client = redis;
  const results = await remindStaleIncidents({
    clientFor: (token) => new WebClient(token),
    claim: async (key, ttlSeconds) =>
      (await client.set(key, "1", { nx: true, ex: ttlSeconds })) !== null,
    dashboardUrl:
      env().NODE_ENV === "production"
        ? "https://app.openstatus.dev"
        : "http://localhost:3001",
  });
  logger.info("incident reminders sent: {sent}, skipped: {skipped}", {
    sent: results.filter((r) => r.target !== null).length,
    skipped: results.filter((r) => r.target === null).length,
  });
  return results;
}
