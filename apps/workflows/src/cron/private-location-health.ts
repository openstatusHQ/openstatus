import { getLogger } from "@logtape/logtape";
import { db, eq, isNotNull } from "@openstatus/db";
import {
  privateLocation,
  selectWorkspaceSchema,
  user,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";
import { EmailClient } from "@openstatus/emails";
import { setPrivateLocationStatus } from "@openstatus/services/private-location";
import type { Context } from "hono";

import { env } from "../env";
import { reportBackgroundError, runSentryCron } from "../lib/sentry";

const logger = getLogger(["workflow", "private-location-health"]);

export const emailClient = new EmailClient({ apiKey: env().RESEND_API_KEY });

export const STALE_THRESHOLD_MS = 15 * 60 * 1000;

type HealthSummary = { checked: number; toError: number; toActive: number };

/**
 * Flip private-location status from the agent heartbeat and email members on
 * every transition. Locations that have never reported (`lastSeenAt IS NULL`)
 * stay `active` and are skipped.
 */
export async function runPrivateLocationHealth(
  now: Date = new Date(),
): Promise<HealthSummary> {
  const locations = await db
    .select({
      id: privateLocation.id,
      name: privateLocation.name,
      status: privateLocation.status,
      lastSeenAt: privateLocation.lastSeenAt,
      workspaceId: privateLocation.workspaceId,
    })
    .from(privateLocation)
    .where(isNotNull(privateLocation.lastSeenAt))
    .all();

  const summary: HealthSummary = {
    checked: locations.length,
    toError: 0,
    toActive: 0,
  };

  for (const location of locations) {
    if (location.lastSeenAt === null || location.workspaceId === null) continue;

    const stale =
      now.getTime() - location.lastSeenAt.getTime() > STALE_THRESHOLD_MS;
    const nextStatus =
      location.status === "active" && stale
        ? "error"
        : location.status === "error" && !stale
          ? "active"
          : null;

    if (nextStatus === null) continue;

    const workspaceRow = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, location.workspaceId))
      .get();
    if (!workspaceRow) continue;

    await setPrivateLocationStatus({
      ctx: {
        workspace: selectWorkspaceSchema.parse(workspaceRow),
        actor: { type: "system", job: "private-location-health" },
      },
      input: { id: location.id, status: nextStatus },
    });

    if (nextStatus === "error") summary.toError++;
    else summary.toActive++;

    await notifyMembers({
      workspaceId: location.workspaceId,
      locationName: location.name,
      status: nextStatus === "error" ? "error" : "recovered",
      lastSeenAt: location.lastSeenAt,
    });
  }

  return summary;
}

async function notifyMembers(args: {
  workspaceId: number;
  locationName: string;
  status: "error" | "recovered";
  lastSeenAt: Date;
}) {
  const members = await db
    .select({ email: user.email })
    .from(usersToWorkspaces)
    .innerJoin(user, eq(usersToWorkspaces.userId, user.id))
    .where(eq(usersToWorkspaces.workspaceId, args.workspaceId))
    .all();

  const to = members
    .map((m) => m.email)
    .filter((email): email is string => !!email && email.trim() !== "");

  if (to.length === 0) return;

  try {
    await emailClient.sendPrivateLocationAlert({
      to,
      locationName: args.locationName,
      status: args.status,
      lastSeenAt: args.lastSeenAt,
    });
  } catch (error) {
    logger.error("Failed to send private location alert", {
      workspace_id: args.workspaceId,
      location_name: args.locationName,
      error_message: error instanceof Error ? error.message : String(error),
    });
    void reportBackgroundError(
      `private-location-health: email failed for ${args.locationName}`,
    );
  }
}

export async function handlePrivateLocationHealthCron(c: Context) {
  const { cronCompleted, cronFailed } = runSentryCron(
    "private-location-health",
  );

  // Background chain: must not capture `c` — the handler returns 200 before
  // this resolves (see uptime-freeze.ts).
  void runPrivateLocationHealth()
    .then((summary) => {
      logger.info(
        "private-location-health complete: checked={checked} toError={toError} toActive={toActive}",
        summary,
      );
      void cronCompleted();
    })
    .catch((error) => {
      logger.error("private-location-health errored: {message}", {
        message: error instanceof Error ? error.message : String(error),
      });
      void reportBackgroundError(
        `private-location-health failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      void cronFailed();
    });

  return c.json({ success: true }, 200);
}
