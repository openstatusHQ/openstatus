import { and, count, eq, isNull } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  page,
  pageComponent,
  pageComponentGroup,
  pageSubscriber,
  pageSubscriberToPageComponent,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import type { PhaseResult } from "@openstatus/importers";

import { emitAudit } from "../audit";
import type { DB, ServiceContext } from "../context";
import type { ImportProviderName } from "./schemas";
import { clampPeriodicity, computePhaseStatus } from "./utils";

/**
 * Shared write-context threaded through every phase writer. Bundles the
 * service ctx (actor + workspace for audit attribution), the active
 * `tx`/db handle, and the provider name so per-resource audit rows carry
 * `source: "import"` + the source provider.
 */
export type PhaseContext = {
  ctx: ServiceContext;
  tx: DB;
  provider: ImportProviderName;
};

/**
 * Each phase writer mutates the phase in place:
 *   - sets per-resource `status` ("created" | "skipped" | "failed"),
 *   - stamps `openstatusId` on success,
 *   - records the per-resource `error` string on failure,
 *   - emits one audit row per *created* resource (skipped rows already
 *     have their original create audit; failed rows have nothing to
 *     attribute),
 *   - rolls the phase-level `status` up from its resources.
 *
 * Writers never throw on a single-resource failure — they only throw on
 * infrastructure errors (e.g. a required page record is missing). The
 * orchestrator in `run.ts` catches throws to abort the remaining phases.
 */

function auditMeta(
  pc: PhaseContext,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return { source: "import", provider: pc.provider, ...extra };
}

export async function writePagePhase(
  pc: PhaseContext,
  phase: PhaseResult,
  existingPageId?: number,
): Promise<number> {
  const { ctx, tx } = pc;
  const workspaceId = ctx.workspace.id;
  const limits = ctx.workspace.limits;

  const resource = phase.resources[0];
  if (!resource?.data) {
    throw new Error("No page data found in phase");
  }

  const data = resource.data as {
    workspaceId: number;
    title: string;
    description: string;
    slug: string;
    customDomain: string;
    published: boolean;
    icon: string;
  };

  // Strip the custom domain when the plan doesn't allow one — imports are
  // tolerant (skip/warn) rather than all-or-nothing.
  if (!limits["custom-domain"]) {
    data.customDomain = "";
  }

  if (existingPageId) {
    const existing = await tx
      .select()
      .from(page)
      .where(
        and(eq(page.id, existingPageId), eq(page.workspaceId, workspaceId)),
      )
      .get();

    if (!existing) {
      throw new Error(
        "Provided page not found or does not belong to workspace",
      );
    }

    await tx
      .update(page)
      .set({ title: data.title, description: data.description })
      .where(eq(page.id, existingPageId));

    resource.openstatusId = existingPageId;
    resource.status = "skipped";
    phase.status = computePhaseStatus(phase.resources);
    return existingPageId;
  }

  // Idempotency: slug is unique within a workspace.
  const existingBySlug = await tx
    .select()
    .from(page)
    .where(and(eq(page.slug, data.slug), eq(page.workspaceId, workspaceId)))
    .get();

  if (existingBySlug) {
    resource.openstatusId = existingBySlug.id;
    resource.status = "skipped";
    phase.status = computePhaseStatus(phase.resources);
    return existingBySlug.id;
  }

  const [inserted] = await tx
    .insert(page)
    .values({
      // `workspaceId` from ctx, not from provider-mapped `data`. Every
      // other phase writer (monitor / components / subscriber) already
      // uses the ctx-derived value; this keeps the authority consistent
      // and defends against the (unlikely) case where a provider mapper
      // round-trips the wrong workspace id into resource data.
      workspaceId,
      title: data.title,
      description: data.description,
      slug: data.slug,
      customDomain: data.customDomain,
      published: data.published,
      icon: data.icon,
    })
    .returning({ id: page.id });

  if (!inserted) throw new Error("Failed to insert page");

  resource.openstatusId = inserted.id;
  resource.status = "created";
  phase.status = computePhaseStatus(phase.resources);

  await emitAudit(tx, ctx, {
    action: "page.create",
    entityType: "page",
    entityId: inserted.id,
    metadata: auditMeta(pc, { sourceId: resource.sourceId, slug: data.slug }),
  });

  return inserted.id;
}

export async function writeComponentGroupsPhase(
  pc: PhaseContext,
  phase: PhaseResult,
  pageId: number,
  groupIdMap: Map<string, number>,
): Promise<void> {
  const { ctx, tx } = pc;
  const workspaceId = ctx.workspace.id;

  for (const resource of phase.resources) {
    try {
      const data = resource.data as {
        workspaceId: number;
        pageId: number;
        name: string;
      };

      const existing = await tx
        .select()
        .from(pageComponentGroup)
        .where(
          and(
            eq(pageComponentGroup.name, data.name),
            eq(pageComponentGroup.pageId, pageId),
          ),
        )
        .get();

      if (existing) {
        groupIdMap.set(resource.sourceId, existing.id);
        resource.openstatusId = existing.id;
        resource.status = "skipped";
        continue;
      }

      const [inserted] = await tx
        .insert(pageComponentGroup)
        .values({ workspaceId, pageId, name: data.name })
        .returning({ id: pageComponentGroup.id });

      if (!inserted) {
        resource.status = "failed";
        resource.error = "Insert returned no result";
        continue;
      }

      groupIdMap.set(resource.sourceId, inserted.id);
      resource.openstatusId = inserted.id;
      resource.status = "created";

      await emitAudit(tx, ctx, {
        action: "page_component_group.create",
        entityType: "page_component_group",
        entityId: inserted.id,
        metadata: auditMeta(pc, {
          sourceId: resource.sourceId,
          pageId,
          name: data.name,
        }),
      });
    } catch (err) {
      resource.status = "failed";
      resource.error = err instanceof Error ? err.message : String(err);
    }
  }

  phase.status = computePhaseStatus(phase.resources);
}

export async function writeComponentsPhase(
  pc: PhaseContext,
  phase: PhaseResult,
  pageId: number,
  groupIdMap: Map<string, number>,
  componentIdMap: Map<string, number>,
  monitorIdMap?: Map<string, number>,
): Promise<void> {
  const { ctx, tx } = pc;
  const workspaceId = ctx.workspace.id;

  for (const resource of phase.resources) {
    if (resource.status === "skipped") continue;

    try {
      const data = resource.data as {
        workspaceId: number;
        pageId: number;
        type: "static" | "monitor";
        monitorId: number | null;
        sourceMonitorId?: string | null;
        name: string;
        description: string | null;
        order: number;
        sourceGroupId: string | null;
      };

      if (data.type === "monitor") {
        if (data.sourceMonitorId && monitorIdMap) {
          data.monitorId = monitorIdMap.get(data.sourceMonitorId) ?? null;
        }
        if (!data.monitorId) {
          // Monitor wasn't imported — usually because the monitors
          // phase was skipped (e.g. `options.includeMonitors === false`)
          // or the monitor itself failed to import. We fall back to a
          // static component so the component still lands, but flag
          // the degrade so the summary doesn't quietly report a
          // "created" monitor component with no monitor attached.
          // `resource.error` is set even though the resource will end
          // up `created` — the other phase writers follow the same
          // convention when degrading.
          data.type = "static";
          resource.error = data.sourceMonitorId
            ? `Source monitor ${data.sourceMonitorId} was not imported; created as static instead.`
            : "No source monitor available; created as static instead.";
        }
      }

      const existing = await tx
        .select()
        .from(pageComponent)
        .where(
          and(
            eq(pageComponent.name, data.name),
            eq(pageComponent.pageId, pageId),
          ),
        )
        .get();

      if (existing) {
        componentIdMap.set(resource.sourceId, existing.id);
        resource.openstatusId = existing.id;
        resource.status = "skipped";
        continue;
      }

      const resolvedGroupId = data.sourceGroupId
        ? groupIdMap.get(data.sourceGroupId) ?? null
        : null;

      const [inserted] = await tx
        .insert(pageComponent)
        .values({
          workspaceId,
          pageId,
          type: data.type,
          monitorId: data.monitorId,
          name: data.name,
          description: data.description,
          order: data.order,
          groupId: resolvedGroupId,
        })
        .returning({ id: pageComponent.id });

      if (!inserted) {
        resource.status = "failed";
        resource.error = "Insert returned no result";
        continue;
      }

      componentIdMap.set(resource.sourceId, inserted.id);
      resource.openstatusId = inserted.id;
      resource.status = "created";

      await emitAudit(tx, ctx, {
        action: "page_component.create",
        entityType: "page_component",
        entityId: inserted.id,
        metadata: auditMeta(pc, {
          sourceId: resource.sourceId,
          pageId,
          type: data.type,
        }),
      });
    } catch (err) {
      resource.status = "failed";
      resource.error = err instanceof Error ? err.message : String(err);
    }
  }

  phase.status = computePhaseStatus(phase.resources);
}

export async function writeIncidentsPhase(
  pc: PhaseContext,
  phase: PhaseResult,
  pageId: number,
  componentIdMap: Map<string, number>,
): Promise<void> {
  const { ctx, tx } = pc;
  const workspaceId = ctx.workspace.id;

  for (const resource of phase.resources) {
    try {
      const data = resource.data as {
        report: {
          title: string;
          status: "investigating" | "identified" | "monitoring" | "resolved";
          workspaceId: number;
          pageId: number;
        };
        updates: Array<{
          status: "investigating" | "identified" | "monitoring" | "resolved";
          message: string;
          date: Date;
        }>;
        sourceComponentIds: string[];
      };

      // Idempotency by `(title, pageId)` — every other phase writer
      // (page slug, monitor url, component name, subscriber email)
      // skips on duplicate before inserting, and imports are
      // explicitly re-runnable per `run.ts`'s phase-level recovery
      // model. Without this check, re-running an import would land
      // duplicate status reports on every pass.
      const existingReport = await tx
        .select({ id: statusReport.id })
        .from(statusReport)
        .where(
          and(
            eq(statusReport.pageId, pageId),
            eq(statusReport.workspaceId, workspaceId),
            eq(statusReport.title, data.report.title),
          ),
        )
        .get();

      if (existingReport) {
        resource.openstatusId = existingReport.id;
        resource.status = "skipped";
        // Reconcile component links on rerun. First run may have
        // written the report with a partial `componentIdMap` (some
        // components failed in their per-resource catch), so the link
        // set is a strict subset of `sourceComponentIds`. On rerun the
        // map is typically more complete — reinsert with
        // `onConflictDoNothing` so the composite PK dedupes already-
        // written pairs and new ones land.
        const reconciliationLinks = data.sourceComponentIds
          .map((sourceId) => componentIdMap.get(sourceId))
          .filter((id): id is number => id != null)
          .map((pageComponentId) => ({
            statusReportId: existingReport.id,
            pageComponentId,
          }));
        if (reconciliationLinks.length > 0) {
          await tx
            .insert(statusReportsToPageComponents)
            .values(reconciliationLinks)
            .onConflictDoNothing();
        }
        continue;
      }

      const [insertedReport] = await tx
        .insert(statusReport)
        .values({
          title: data.report.title,
          status: data.report.status,
          workspaceId,
          pageId,
        })
        .returning({ id: statusReport.id });

      if (!insertedReport) {
        resource.status = "failed";
        resource.error = "Failed to insert status report";
        continue;
      }

      await emitAudit(tx, ctx, {
        action: "status_report.create",
        entityType: "status_report",
        entityId: insertedReport.id,
        metadata: auditMeta(pc, {
          sourceId: resource.sourceId,
          pageId,
          title: data.report.title,
        }),
      });

      // Batch the update rows with `.returning()` so per-update audit can
      // attribute the specific update ids.
      if (data.updates.length > 0) {
        const insertedUpdates = await tx
          .insert(statusReportUpdate)
          .values(
            data.updates.map((u) => ({
              status: u.status,
              message: u.message,
              date: u.date,
              statusReportId: insertedReport.id,
            })),
          )
          .returning({ id: statusReportUpdate.id });

        for (const row of insertedUpdates) {
          await emitAudit(tx, ctx, {
            action: "status_report.add_update",
            entityType: "status_report_update",
            entityId: row.id,
            metadata: auditMeta(pc, {
              sourceId: resource.sourceId,
              statusReportId: insertedReport.id,
            }),
          });
        }
      }

      const componentLinks: Array<{
        statusReportId: number;
        pageComponentId: number;
      }> = [];
      for (const sourceCompId of data.sourceComponentIds) {
        const osCompId = componentIdMap.get(sourceCompId);
        if (osCompId) {
          componentLinks.push({
            statusReportId: insertedReport.id,
            pageComponentId: osCompId,
          });
        }
      }
      if (componentLinks.length > 0) {
        await tx.insert(statusReportsToPageComponents).values(componentLinks);
      }

      resource.openstatusId = insertedReport.id;
      resource.status = "created";
    } catch (err) {
      resource.status = "failed";
      resource.error = err instanceof Error ? err.message : String(err);
    }
  }

  phase.status = computePhaseStatus(phase.resources);
}

export async function writeMaintenancesPhase(
  pc: PhaseContext,
  phase: PhaseResult,
  pageId: number,
  componentIdMap: Map<string, number>,
): Promise<void> {
  const { ctx, tx } = pc;
  const workspaceId = ctx.workspace.id;

  for (const resource of phase.resources) {
    try {
      const data = resource.data as {
        title: string;
        message: string;
        from: Date;
        to: Date;
        workspaceId: number;
        pageId: number;
        sourceComponentIds: string[];
      };

      // Idempotency by `(title, pageId, from, to)` — re-running an
      // import shouldn't create duplicate maintenance windows on each
      // pass. `title + pageId` alone could collide on unrelated future
      // maintenances sharing a name ("DB upgrade"), so the `from/to`
      // pair pins the match to a specific scheduled window. Same
      // reasoning as the status-report idempotency check above.
      const existing = await tx
        .select({ id: maintenance.id })
        .from(maintenance)
        .where(
          and(
            eq(maintenance.pageId, pageId),
            eq(maintenance.workspaceId, workspaceId),
            eq(maintenance.title, data.title),
            eq(maintenance.from, data.from),
            eq(maintenance.to, data.to),
          ),
        )
        .get();

      if (existing) {
        resource.openstatusId = existing.id;
        resource.status = "skipped";
        // Same reconciliation rationale as `writeIncidentsPhase` — a
        // partial `componentIdMap` on the first run means the link
        // set may be incomplete, and the composite PK on
        // `(maintenanceId, pageComponentId)` makes the re-insert a
        // no-op for pairs that already exist.
        const reconciliationLinks = data.sourceComponentIds
          .map((sourceId) => componentIdMap.get(sourceId))
          .filter((id): id is number => id != null)
          .map((pageComponentId) => ({
            maintenanceId: existing.id,
            pageComponentId,
          }));
        if (reconciliationLinks.length > 0) {
          await tx
            .insert(maintenancesToPageComponents)
            .values(reconciliationLinks)
            .onConflictDoNothing();
        }
        continue;
      }

      const [inserted] = await tx
        .insert(maintenance)
        .values({
          title: data.title,
          message: data.message,
          from: data.from,
          to: data.to,
          workspaceId,
          pageId,
        })
        .returning({ id: maintenance.id });

      if (!inserted) {
        resource.status = "failed";
        resource.error = "Failed to insert maintenance";
        continue;
      }

      const componentLinks: Array<{
        maintenanceId: number;
        pageComponentId: number;
      }> = [];
      for (const sourceCompId of data.sourceComponentIds) {
        const osCompId = componentIdMap.get(sourceCompId);
        if (osCompId) {
          componentLinks.push({
            maintenanceId: inserted.id,
            pageComponentId: osCompId,
          });
        }
      }
      if (componentLinks.length > 0) {
        await tx.insert(maintenancesToPageComponents).values(componentLinks);
      }

      resource.openstatusId = inserted.id;
      resource.status = "created";

      await emitAudit(tx, ctx, {
        action: "maintenance.create",
        entityType: "maintenance",
        entityId: inserted.id,
        metadata: auditMeta(pc, {
          sourceId: resource.sourceId,
          pageId,
          title: data.title,
        }),
      });
    } catch (err) {
      resource.status = "failed";
      resource.error = err instanceof Error ? err.message : String(err);
    }
  }

  phase.status = computePhaseStatus(phase.resources);
}

export async function writeMonitorsPhase(
  pc: PhaseContext,
  phase: PhaseResult,
  monitorIdMap: Map<string, number>,
): Promise<void> {
  const { ctx, tx } = pc;
  const workspaceId = ctx.workspace.id;
  const limits = ctx.workspace.limits;

  const [monitorCount] = await tx
    .select({ count: count() })
    .from(monitor)
    .where(
      and(eq(monitor.workspaceId, workspaceId), isNull(monitor.deletedAt)),
    );
  const maxMonitors = limits.monitors;
  const remaining = maxMonitors - (monitorCount?.count ?? 0);

  if (remaining <= 0) {
    for (const resource of phase.resources) {
      resource.status = "skipped";
      resource.error = `Skipped: monitor limit reached (${maxMonitors})`;
    }
    phase.status = computePhaseStatus(phase.resources);
    return;
  }

  let importedCount = 0;
  for (const resource of phase.resources) {
    if (importedCount >= remaining) {
      resource.status = "skipped";
      resource.error = `Skipped: would exceed monitor limit (${maxMonitors})`;
      continue;
    }

    try {
      const data = resource.data as {
        workspaceId: number;
        jobType: string;
        periodicity: string;
        status: string;
        active: boolean;
        regions: string;
        url: string;
        name: string;
        description: string;
        headers: string;
        body: string;
        method: string;
        timeout: number;
        sourceMonitorGroupId: string | null;
      };

      // Idempotency: same url in the workspace (active only).
      const existing = await tx
        .select()
        .from(monitor)
        .where(
          and(
            eq(monitor.url, data.url),
            eq(monitor.workspaceId, workspaceId),
            isNull(monitor.deletedAt),
          ),
        )
        .get();

      if (existing) {
        monitorIdMap.set(resource.sourceId, existing.id);
        resource.openstatusId = existing.id;
        resource.status = "skipped";
        continue;
      }

      const periodicity = clampPeriodicity(
        data.periodicity,
        limits.periodicity,
      );

      const [inserted] = await tx
        .insert(monitor)
        .values({
          workspaceId,
          jobType: data.jobType as
            | "http"
            | "tcp"
            | "icmp"
            | "udp"
            | "dns"
            | "ssl",
          periodicity: periodicity as
            | "30s"
            | "1m"
            | "5m"
            | "10m"
            | "30m"
            | "1h"
            | "other",
          status: "active",
          active: data.active,
          regions: data.regions,
          url: data.url,
          name: data.name,
          description: data.description,
          headers: data.headers,
          body: data.body,
          method: data.method as
            | "GET"
            | "POST"
            | "HEAD"
            | "PUT"
            | "PATCH"
            | "DELETE"
            | "TRACE"
            | "CONNECT"
            | "OPTIONS",
          timeout: data.timeout,
        })
        .returning({ id: monitor.id });

      if (!inserted) {
        resource.status = "failed";
        resource.error = "Insert returned no result";
        continue;
      }

      monitorIdMap.set(resource.sourceId, inserted.id);
      resource.openstatusId = inserted.id;
      resource.status = "created";
      importedCount++;

      await emitAudit(tx, ctx, {
        action: "monitor.create",
        entityType: "monitor",
        entityId: inserted.id,
        metadata: auditMeta(pc, {
          sourceId: resource.sourceId,
          url: data.url,
          jobType: data.jobType,
        }),
      });
    } catch (err) {
      resource.status = "failed";
      resource.error = err instanceof Error ? err.message : String(err);
    }
  }

  phase.status = computePhaseStatus(phase.resources);
}

// TODO: migrate to new `pageSubscription` + `pageSubscriptionToPageComponent` tables
export async function writeSubscribersPhase(
  pc: PhaseContext,
  phase: PhaseResult,
  pageId: number,
  componentIdMap: Map<string, number>,
): Promise<void> {
  const { ctx, tx } = pc;

  for (const resource of phase.resources) {
    try {
      const data = resource.data as {
        email: string;
        pageId: number;
        confirmed: boolean;
        sourceComponentIds: string[];
      };

      const email = data.email.toLowerCase();

      const existing = await tx
        .select()
        .from(pageSubscriber)
        .where(
          and(
            eq(pageSubscriber.email, email),
            eq(pageSubscriber.pageId, pageId),
            eq(pageSubscriber.channelType, "email"),
          ),
        )
        .get();

      if (existing) {
        resource.openstatusId = existing.id;
        resource.status = "skipped";
        // Same reconciliation rationale as `writeIncidentsPhase` — a
        // partial `componentIdMap` on the first run means the link
        // set may be incomplete, and the composite PK on
        // `(pageSubscriberId, pageComponentId)` makes the re-insert a
        // no-op for pairs that already exist.
        const reconciliationLinks = data.sourceComponentIds
          .map((sourceId) => componentIdMap.get(sourceId))
          .filter((id): id is number => id != null)
          .map((pageComponentId) => ({
            pageSubscriberId: existing.id,
            pageComponentId,
          }));
        if (reconciliationLinks.length > 0) {
          await tx
            .insert(pageSubscriberToPageComponent)
            .values(reconciliationLinks)
            .onConflictDoNothing();
        }
        continue;
      }

      const [inserted] = await tx
        .insert(pageSubscriber)
        .values({
          email,
          pageId,
          channelType: "email",
          source: "import",
          token: crypto.randomUUID(),
          acceptedAt: data.confirmed ? new Date() : undefined,
        })
        .returning({ id: pageSubscriber.id });

      if (!inserted) {
        resource.status = "failed";
        resource.error = "Insert returned no result";
        continue;
      }

      const componentLinks: Array<{
        pageSubscriberId: number;
        pageComponentId: number;
      }> = [];
      for (const sourceCompId of data.sourceComponentIds) {
        const osCompId = componentIdMap.get(sourceCompId);
        if (osCompId) {
          componentLinks.push({
            pageSubscriberId: inserted.id,
            pageComponentId: osCompId,
          });
        }
      }
      if (componentLinks.length > 0) {
        await tx.insert(pageSubscriberToPageComponent).values(componentLinks);
      }

      resource.openstatusId = inserted.id;
      resource.status = "created";

      await emitAudit(tx, ctx, {
        action: "page_subscriber.create",
        entityType: "page_subscriber",
        entityId: inserted.id,
        metadata: auditMeta(pc, {
          sourceId: resource.sourceId,
          pageId,
          email,
        }),
      });
    } catch (err) {
      resource.status = "failed";
      resource.error = err instanceof Error ? err.message : String(err);
    }
  }

  phase.status = computePhaseStatus(phase.resources);
}
