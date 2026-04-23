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
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import type { PhaseResult } from "@openstatus/importers";

import type { DB } from "../context";
import { clampPeriodicity, computePhaseStatus } from "./utils";

/**
 * Each phase writer mutates the phase in place:
 *   - sets per-resource `status` ("created" | "skipped" | "failed"),
 *   - stamps `openstatusId` on success,
 *   - records the per-resource `error` string on failure,
 *   - rolls the phase-level `status` up from its resources.
 *
 * Writers never throw on a single-resource failure — they only throw on
 * infrastructure errors (e.g. a required page record is missing). The
 * orchestrator in `run.ts` catches throws to abort the remaining phases.
 */

export async function writePagePhase(
  db: DB,
  phase: PhaseResult,
  workspaceId: number,
  existingPageId?: number,
  limits?: Limits,
): Promise<number> {
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
  if (limits && !limits["custom-domain"]) {
    data.customDomain = "";
  }

  if (existingPageId) {
    const existing = await db
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

    await db
      .update(page)
      .set({ title: data.title, description: data.description })
      .where(eq(page.id, existingPageId));

    resource.openstatusId = existingPageId;
    resource.status = "skipped";
    phase.status = computePhaseStatus(phase.resources);
    return existingPageId;
  }

  // Idempotency: slug is unique within a workspace.
  const existingBySlug = await db
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

  const [inserted] = await db
    .insert(page)
    .values({
      workspaceId: data.workspaceId,
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
  return inserted.id;
}

export async function writeComponentGroupsPhase(
  db: DB,
  phase: PhaseResult,
  workspaceId: number,
  pageId: number,
  groupIdMap: Map<string, number>,
): Promise<void> {
  for (const resource of phase.resources) {
    try {
      const data = resource.data as {
        workspaceId: number;
        pageId: number;
        name: string;
      };

      const existing = await db
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

      const [inserted] = await db
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
    } catch (err) {
      resource.status = "failed";
      resource.error = err instanceof Error ? err.message : String(err);
    }
  }

  phase.status = computePhaseStatus(phase.resources);
}

export async function writeComponentsPhase(
  db: DB,
  phase: PhaseResult,
  workspaceId: number,
  pageId: number,
  groupIdMap: Map<string, number>,
  componentIdMap: Map<string, number>,
  monitorIdMap?: Map<string, number>,
): Promise<void> {
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
          // Monitor wasn't imported; fall back to a static component so
          // we don't drop the resource entirely.
          data.type = "static";
        }
      }

      const existing = await db
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

      const [inserted] = await db
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
    } catch (err) {
      resource.status = "failed";
      resource.error = err instanceof Error ? err.message : String(err);
    }
  }

  phase.status = computePhaseStatus(phase.resources);
}

export async function writeIncidentsPhase(
  db: DB,
  phase: PhaseResult,
  workspaceId: number,
  pageId: number,
  componentIdMap: Map<string, number>,
): Promise<void> {
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

      const [insertedReport] = await db
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

      if (data.updates.length > 0) {
        await db.insert(statusReportUpdate).values(
          data.updates.map((u) => ({
            status: u.status,
            message: u.message,
            date: u.date,
            statusReportId: insertedReport.id,
          })),
        );
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
        await db.insert(statusReportsToPageComponents).values(componentLinks);
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
  db: DB,
  phase: PhaseResult,
  workspaceId: number,
  pageId: number,
  componentIdMap: Map<string, number>,
): Promise<void> {
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

      const [inserted] = await db
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
        await db.insert(maintenancesToPageComponents).values(componentLinks);
      }

      resource.openstatusId = inserted.id;
      resource.status = "created";
    } catch (err) {
      resource.status = "failed";
      resource.error = err instanceof Error ? err.message : String(err);
    }
  }

  phase.status = computePhaseStatus(phase.resources);
}

export async function writeMonitorsPhase(
  db: DB,
  phase: PhaseResult,
  workspaceId: number,
  monitorIdMap: Map<string, number>,
  limits: Limits,
): Promise<void> {
  const [monitorCount] = await db
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
      const existing = await db
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

      const [inserted] = await db
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
    } catch (err) {
      resource.status = "failed";
      resource.error = err instanceof Error ? err.message : String(err);
    }
  }

  phase.status = computePhaseStatus(phase.resources);
}

// TODO: migrate to new `pageSubscription` + `pageSubscriptionToPageComponent` tables
export async function writeSubscribersPhase(
  db: DB,
  phase: PhaseResult,
  pageId: number,
  componentIdMap: Map<string, number>,
): Promise<void> {
  for (const resource of phase.resources) {
    try {
      const data = resource.data as {
        email: string;
        pageId: number;
        confirmed: boolean;
        sourceComponentIds: string[];
      };

      const email = data.email.toLowerCase();

      const existing = await db
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
        continue;
      }

      const [inserted] = await db
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
        await db.insert(pageSubscriberToPageComponent).values(componentLinks);
      }

      resource.openstatusId = inserted.id;
      resource.status = "created";
    } catch (err) {
      resource.status = "failed";
      resource.error = err instanceof Error ? err.message : String(err);
    }
  }

  phase.status = computePhaseStatus(phase.resources);
}
