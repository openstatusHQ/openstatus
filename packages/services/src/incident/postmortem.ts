import { eq } from "@openstatus/db";
import {
  type IncidentPostmortem,
  incidentPostmortem,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import {
  type DB,
  type ServiceContext,
  getReadDb,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ConflictError, NotFoundError } from "../errors";
import { closeIncidentInTx } from "./close";
import { appendIncidentEvent, getIncidentInWorkspace } from "./internal";
import {
  ApprovePostmortemInput,
  DraftPostmortemInput,
  IncidentIdInput,
} from "./schemas";

async function findPostmortem(
  db: DB,
  incidentId: number,
): Promise<IncidentPostmortem | undefined> {
  return db
    .select()
    .from(incidentPostmortem)
    .where(eq(incidentPostmortem.incidentId, incidentId))
    .get();
}

/**
 * Writes the postmortem: creates the draft, or overwrites the body. An
 * approved postmortem stays approved when a person edits it; the agent may
 * only redraft while it is still a draft.
 */
export async function draftPostmortem(args: {
  ctx: ServiceContext;
  input: DraftPostmortemInput;
}): Promise<IncidentPostmortem> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = DraftPostmortemInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const row = await getIncidentInWorkspace(tx, ctx.workspace.id, input.id);
    if (row.status !== "resolved") {
      throw new ConflictError(
        `A postmortem needs a resolved incident; #${row.id} is ${row.status}`,
      );
    }
    const userId = tryGetActorUserId(ctx.actor);
    const existing = await findPostmortem(tx, row.id);

    if (!existing) {
      const created = await tx
        .insert(incidentPostmortem)
        .values({
          incidentId: row.id,
          content: input.content,
          draftedBy: input.draftedBy,
          sourceTranscript: input.sourceTranscript ?? null,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning()
        .get();
      await emitAudit(tx, ctx, {
        action: "incident_postmortem.create",
        entityType: "incident_postmortem",
        entityId: created.id,
        after: created,
        metadata: { incidentId: row.id },
      });
      await appendIncidentEvent(tx, ctx, {
        incidentId: row.id,
        type: "postmortem_drafted",
        message:
          input.draftedBy === "agent"
            ? "Postmortem drafted by the agent"
            : "Postmortem drafted",
      });
      return created;
    }

    if (existing.status === "approved" && input.draftedBy === "agent") {
      throw new ConflictError(
        "The postmortem is approved; edit it instead of redrafting",
      );
    }
    const updated = await tx
      .update(incidentPostmortem)
      .set({
        content: input.content,
        draftedBy:
          existing.status === "approved" ? existing.draftedBy : input.draftedBy,
        ...(input.sourceTranscript !== undefined
          ? { sourceTranscript: input.sourceTranscript }
          : {}),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(incidentPostmortem.id, existing.id))
      .returning()
      .get();
    await emitAudit(tx, ctx, {
      action: "incident_postmortem.update",
      entityType: "incident_postmortem",
      entityId: updated.id,
      before: existing,
      after: updated,
      metadata: { incidentId: row.id },
    });
    await appendIncidentEvent(tx, ctx, {
      incidentId: row.id,
      type:
        existing.status === "approved"
          ? "postmortem_updated"
          : "postmortem_drafted",
      message:
        existing.status === "approved"
          ? "Postmortem edited"
          : input.draftedBy === "agent"
            ? "Postmortem redrafted by the agent"
            : "Postmortem draft updated",
    });
    return updated;
  });
}

/** Admin, owner or the commander signs the postmortem off; optionally closes. */
export async function approvePostmortem(args: {
  ctx: ServiceContext;
  input: ApprovePostmortemInput;
}): Promise<IncidentPostmortem> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = ApprovePostmortemInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const row = await getIncidentInWorkspace(tx, ctx.workspace.id, input.id);
    await requireRole(tx, ctx, ["owner", "admin"], {
      orUserId: row.commanderId,
    });
    const existing = await findPostmortem(tx, row.id);
    if (!existing) throw new NotFoundError("incident_postmortem", row.id);
    if (existing.status === "approved") {
      throw new ConflictError("The postmortem is already approved");
    }

    const userId = tryGetActorUserId(ctx.actor);
    const now = new Date();
    const approved = await tx
      .update(incidentPostmortem)
      .set({
        status: "approved",
        approvedBy: userId,
        approvedAt: now,
        updatedBy: userId,
        updatedAt: now,
      })
      .where(eq(incidentPostmortem.id, existing.id))
      .returning()
      .get();
    await emitAudit(tx, ctx, {
      action: "incident_postmortem.update",
      entityType: "incident_postmortem",
      entityId: approved.id,
      before: existing,
      after: approved,
      metadata: { incidentId: row.id },
    });
    await appendIncidentEvent(tx, ctx, {
      incidentId: row.id,
      type: "postmortem_approved",
      message: "Postmortem approved",
      createdAt: now,
    });
    if (input.close && !row.closedAt) {
      await closeIncidentInTx(tx, ctx, row);
    }
    return approved;
  });
}

export async function getPostmortem(args: {
  ctx: ServiceContext;
  input: IncidentIdInput;
}): Promise<IncidentPostmortem | undefined> {
  const { ctx } = args;
  const input = IncidentIdInput.parse(args.input);
  const db = getReadDb(ctx);
  const row = await getIncidentInWorkspace(db, ctx.workspace.id, input.id);
  return findPostmortem(db, row.id);
}
