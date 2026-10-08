import { and, eq, ne } from "@openstatus/db";
import { type Incident, incident } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError } from "../errors";
import {
  appendIncidentEvent,
  assertNotClosed,
  getIncidentInWorkspace,
} from "./internal";
import { BindIncidentSlackChannelInput, IncidentIdInput } from "./schemas";

export async function bindIncidentSlackChannel(args: {
  ctx: ServiceContext;
  input: BindIncidentSlackChannelInput;
}): Promise<Incident> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = BindIncidentSlackChannelInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace(
      tx,
      ctx.workspace.id,
      input.id,
    );
    assertNotClosed(existing);
    if (
      existing.slackTeamId === input.teamId &&
      existing.slackChannelId === input.channelId
    ) {
      return existing;
    }
    const holder = await tx
      .select({ id: incident.id })
      .from(incident)
      .where(
        and(
          eq(incident.slackTeamId, input.teamId),
          eq(incident.slackChannelId, input.channelId),
          ne(incident.id, existing.id),
        ),
      )
      .get();
    if (holder) {
      throw new ConflictError(
        `This Slack channel is already bound to incident #${holder.id}`,
      );
    }

    const updated = await tx
      .update(incident)
      .set({
        slackTeamId: input.teamId,
        slackChannelId: input.channelId,
        updatedAt: new Date(),
      })
      .where(eq(incident.id, existing.id))
      .returning()
      .get();
    await emitAudit(tx, ctx, {
      action: "incident.update",
      entityType: "incident",
      entityId: updated.id,
      before: existing,
      after: updated,
      metadata: { slackTeamId: input.teamId, slackChannelId: input.channelId },
    });
    await appendIncidentEvent(tx, ctx, {
      incidentId: updated.id,
      type: "slack_channel_bound",
      message: `Slack channel <#${input.channelId}> bound`,
    });
    return updated;
  });
}

/** Allowed on a closed incident: it runs when its channel is archived. */
export async function unbindIncidentSlackChannel(args: {
  ctx: ServiceContext;
  input: IncidentIdInput;
}): Promise<Incident> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = IncidentIdInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace(
      tx,
      ctx.workspace.id,
      input.id,
    );
    if (existing.slackChannelId === null) return existing;

    const updated = await tx
      .update(incident)
      .set({ slackTeamId: null, slackChannelId: null, updatedAt: new Date() })
      .where(eq(incident.id, existing.id))
      .returning()
      .get();
    await emitAudit(tx, ctx, {
      action: "incident.update",
      entityType: "incident",
      entityId: updated.id,
      before: existing,
      after: updated,
    });
    await appendIncidentEvent(tx, ctx, {
      incidentId: updated.id,
      type: "slack_channel_unbound",
      message: `Slack channel <#${existing.slackChannelId}> unbound`,
    });
    return updated;
  });
}
