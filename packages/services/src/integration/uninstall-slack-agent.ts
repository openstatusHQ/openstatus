import { and, db as defaultDb, eq, inArray } from "@openstatus/db";
import { incident, integration, workspace } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type DB, type ServiceContext, withTransaction } from "../context";
import { unbindIncidentSlackChannel } from "../incident/slack-channel";
import { parseWorkspaceForContext } from "../page-subscriber/internal";
import { removeSlackTeamSubscribers } from "../page-subscriber/slack";
import { deleteSlackUserMappings } from "../slack-user/internal";
import { UninstallSlackTeamInput } from "./schemas";
import { snapshotIntegration } from "./snapshot";

/**
 * Removes the workspace's link to a Slack team after Slack reports the app
 * uninstalled or its bot token revoked: the integration row and the team's
 * Slack account links go, each with its audit row.
 */
export async function uninstallSlackAgent(args: {
  ctx: ServiceContext;
  input: UninstallSlackTeamInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UninstallSlackTeamInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const removed = await tx
      .delete(integration)
      .where(
        and(
          eq(integration.name, "slack-agent"),
          eq(integration.workspaceId, ctx.workspace.id),
          eq(integration.externalId, input.teamId),
        ),
      )
      .returning();
    for (const row of removed) {
      await emitAudit(tx, ctx, {
        action: "integration.delete",
        entityType: "integration",
        entityId: row.id,
        before: await snapshotIntegration(row),
      });
    }
    await deleteSlackUserMappings({
      tx,
      ctx,
      where: { slackTeamId: input.teamId },
    });

    const bound = await tx
      .select({ id: incident.id })
      .from(incident)
      .where(
        and(
          eq(incident.workspaceId, ctx.workspace.id),
          eq(incident.slackTeamId, input.teamId),
        ),
      )
      .all();
    for (const row of bound) {
      await unbindIncidentSlackChannel({
        ctx: { ...ctx, db: tx },
        input: { id: row.id },
      });
    }
  });
}

/**
 * Every workspace connected to the Slack team is uninstalled, and every
 * channel of that team stops receiving status-page updates, whichever
 * workspace owns the page.
 */
export async function uninstallSlackTeam(args: {
  input: UninstallSlackTeamInput;
  job: string;
  db?: DB;
}): Promise<{ workspaces: number; unsubscribed: number }> {
  const input = UninstallSlackTeamInput.parse(args.input);
  const readDb = args.db ?? defaultDb;
  const rows = await readDb
    .select()
    .from(workspace)
    .where(
      inArray(
        workspace.id,
        readDb
          .select({ id: integration.workspaceId })
          .from(integration)
          .where(
            and(
              eq(integration.name, "slack-agent"),
              eq(integration.externalId, input.teamId),
            ),
          ),
      ),
    )
    .all();
  for (const row of rows) {
    await uninstallSlackAgent({
      ctx: {
        workspace: parseWorkspaceForContext(row),
        actor: { type: "system", job: args.job },
        db: args.db,
      },
      input,
    });
  }
  const unsubscribed = await removeSlackTeamSubscribers({
    input,
    job: args.job,
    db: args.db,
  });
  return { workspaces: rows.length, unsubscribed };
}
