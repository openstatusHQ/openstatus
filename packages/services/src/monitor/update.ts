import { and, eq, inArray, isNull } from "@openstatus/db";
import { monitor, selectMonitorSchema } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import type { Monitor } from "../types";
import {
  getMonitorInWorkspace,
  headersToDbJson,
  serialiseAssertions,
} from "./internal";
import {
  BulkUpdateMonitorsInput,
  UpdateMonitorFollowRedirectsInput,
  UpdateMonitorGeneralInput,
  UpdateMonitorOtelInput,
  UpdateMonitorPublicInput,
  UpdateMonitorResponseTimeInput,
  UpdateMonitorRetryInput,
} from "./schemas";

/**
 * Update a monitor's "general" fields — name / endpoint / method / headers /
 * body / assertions / active. Mirrors the tRPC `updateGeneral` surface and
 * intentionally allows jobType switching (e.g. HTTP → TCP) to preserve the
 * existing dashboard flow.
 */
export async function updateMonitorGeneral(args: {
  ctx: ServiceContext;
  input: UpdateMonitorGeneralInput;
}): Promise<Monitor> {
  const { ctx } = args;
  const input = UpdateMonitorGeneralInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getMonitorInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    const updated = await tx
      .update(monitor)
      .set({
        name: input.name,
        jobType: input.jobType,
        url: input.url,
        method: input.method,
        headers: headersToDbJson(input.headers),
        body: input.body,
        active: input.active,
        assertions: serialiseAssertions(input.assertions),
        updatedAt: new Date(),
      })
      .where(eq(monitor.id, existing.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "monitor.update_general",
      entityType: "monitor",
      entityId: existing.id,
      before: existing,
      after: updated,
    });

    return selectMonitorSchema.parse(updated);
  });
}

export async function updateMonitorRetry(args: {
  ctx: ServiceContext;
  input: UpdateMonitorRetryInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdateMonitorRetryInput.parse(args.input);
  await withTransaction(ctx, async (tx) => {
    const existing = await getMonitorInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    await tx
      .update(monitor)
      .set({ retry: input.retry, updatedAt: new Date() })
      .where(eq(monitor.id, existing.id))
      .run();
    await emitAudit(tx, ctx, {
      action: "monitor.update_retry",
      entityType: "monitor",
      entityId: existing.id,
      metadata: { retry: input.retry },
    });
  });
}

export async function updateMonitorFollowRedirects(args: {
  ctx: ServiceContext;
  input: UpdateMonitorFollowRedirectsInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdateMonitorFollowRedirectsInput.parse(args.input);
  await withTransaction(ctx, async (tx) => {
    const existing = await getMonitorInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    await tx
      .update(monitor)
      .set({ followRedirects: input.followRedirects, updatedAt: new Date() })
      .where(eq(monitor.id, existing.id))
      .run();
    await emitAudit(tx, ctx, {
      action: "monitor.update_follow_redirects",
      entityType: "monitor",
      entityId: existing.id,
      metadata: { followRedirects: input.followRedirects },
    });
  });
}

export async function updateMonitorOtel(args: {
  ctx: ServiceContext;
  input: UpdateMonitorOtelInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdateMonitorOtelInput.parse(args.input);
  await withTransaction(ctx, async (tx) => {
    const existing = await getMonitorInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    await tx
      .update(monitor)
      .set({
        otelEndpoint: input.otelEndpoint,
        otelHeaders: input.otelHeaders
          ? JSON.stringify(input.otelHeaders)
          : undefined,
        updatedAt: new Date(),
      })
      .where(eq(monitor.id, existing.id))
      .run();
    await emitAudit(tx, ctx, {
      action: "monitor.update_otel",
      entityType: "monitor",
      entityId: existing.id,
    });
  });
}

export async function updateMonitorPublic(args: {
  ctx: ServiceContext;
  input: UpdateMonitorPublicInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdateMonitorPublicInput.parse(args.input);
  await withTransaction(ctx, async (tx) => {
    const existing = await getMonitorInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    await tx
      .update(monitor)
      .set({ public: input.public, updatedAt: new Date() })
      .where(eq(monitor.id, existing.id))
      .run();
    await emitAudit(tx, ctx, {
      action: "monitor.update_public",
      entityType: "monitor",
      entityId: existing.id,
      metadata: { public: input.public },
    });
  });
}

export async function updateMonitorResponseTime(args: {
  ctx: ServiceContext;
  input: UpdateMonitorResponseTimeInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdateMonitorResponseTimeInput.parse(args.input);
  await withTransaction(ctx, async (tx) => {
    const existing = await getMonitorInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    await tx
      .update(monitor)
      .set({
        timeout: input.timeout,
        degradedAfter: input.degradedAfter,
        updatedAt: new Date(),
      })
      .where(eq(monitor.id, existing.id))
      .run();
    await emitAudit(tx, ctx, {
      action: "monitor.update_response_time",
      entityType: "monitor",
      entityId: existing.id,
    });
  });
}

/**
 * Batched update of `public` / `active` across multiple monitors. All ids
 * must be in the caller's workspace and not soft-deleted; no per-row
 * not-found check (matches the pre-migration behaviour — missing ids are
 * silently ignored).
 */
export async function bulkUpdateMonitors(args: {
  ctx: ServiceContext;
  input: BulkUpdateMonitorsInput;
}): Promise<void> {
  const { ctx } = args;
  const input = BulkUpdateMonitorsInput.parse(args.input);
  if (input.public === undefined && input.active === undefined) return;

  await withTransaction(ctx, async (tx) => {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (input.public !== undefined) set.public = input.public;
    if (input.active !== undefined) set.active = input.active;

    await tx
      .update(monitor)
      .set(set)
      .where(
        and(
          inArray(monitor.id, input.ids),
          eq(monitor.workspaceId, ctx.workspace.id),
          isNull(monitor.deletedAt),
        ),
      );

    for (const id of input.ids) {
      await emitAudit(tx, ctx, {
        action: "monitor.bulk_update",
        entityType: "monitor",
        entityId: id,
        metadata: {
          public: input.public,
          active: input.active,
        },
      });
    }
  });
}
