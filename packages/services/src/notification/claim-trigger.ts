import { db as defaultDb } from "@openstatus/db";
import { notificationTrigger } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { ClaimNotificationTriggerInput } from "./schemas";

/**
 * Claim the one send allowed per notification, monitor and check run. Returns
 * false when another attempt already claimed it, so the caller must not send.
 *
 * No `ServiceContext` and no audit row: delivery bookkeeping on the alerting
 * path, not workspace configuration.
 */
export async function claimNotificationTrigger(args: {
  input: ClaimNotificationTriggerInput;
  db?: DB;
}): Promise<boolean> {
  const input = ClaimNotificationTriggerInput.parse(args.input);
  const rows = await (args.db ?? defaultDb)
    .insert(notificationTrigger)
    .values(input)
    .onConflictDoNothing()
    .returning({ id: notificationTrigger.id });
  return rows.length > 0;
}
