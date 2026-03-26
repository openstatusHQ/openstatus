import { and, db, eq } from "@openstatus/db";
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
import type {
  ImportProvider,
  ImportSummary,
  PhaseResult,
  ResourceResult,
} from "@openstatus/importers";
import { createBetterstackProvider } from "@openstatus/importers/betterstack";
import { createStatuspageProvider } from "@openstatus/importers/statuspage";
import { TRPCError } from "@trpc/server";

type ImportOptions = {
  includeStatusReports?: boolean;
  includeSubscribers?: boolean;
  includeComponents?: boolean;
  includeMonitors?: boolean;
};

function createProvider(
  providerName: string,
  _config: Record<string, unknown>,
): ImportProvider {
  switch (providerName) {
    case "betterstack":
      return createBetterstackProvider();
    default:
      return createStatuspageProvider();
  }
}

/**
 * Inspect an ImportSummary and push warnings into `summary.errors`
 * for any limits that would be hit during import.
 *
 * Used by both preview (to show warnings upfront) and run (before writes).
 */
export async function addLimitWarnings(
  summary: ImportSummary,
  config: {
    limits: Limits;
    workspaceId: number;
    pageId?: number;
  },
): Promise<void> {
  // 1. Component count limit
  const componentsPhase = summary.phases.find((p) => p.phase === "components");
  if (componentsPhase && componentsPhase.resources.length > 0) {
    const maxComponents = config.limits["page-components"];
    let existingCount = 0;
    if (config.pageId) {
      const existing = await db
        .select()
        .from(pageComponent)
        .where(
          and(
            eq(pageComponent.pageId, config.pageId),
            eq(pageComponent.workspaceId, config.workspaceId),
          ),
        )
        .all();
      existingCount = existing.length;
    }
    const remaining = maxComponents - existingCount;
    if (remaining <= 0) {
      summary.errors.push(
        `Component limit reached (${maxComponents}). Upgrade your plan to import components.`,
      );
    } else if (componentsPhase.resources.length > remaining) {
      summary.errors.push(
        `Only ${remaining} of ${componentsPhase.resources.length} components can be imported due to plan limit (${maxComponents}).`,
      );
    }
  }

  // 2. Custom domain
  if (!config.limits["custom-domain"]) {
    const pagePhase = summary.phases.find((p) => p.phase === "page");
    const pageData = pagePhase?.resources[0]?.data as
      | { customDomain?: string }
      | undefined;
    if (pageData?.customDomain) {
      summary.errors.push(
        "Custom domain will be stripped during import. Upgrade your plan to use custom domains.",
      );
    }
  }

  // 3. Monitor count limit
  const monitorsPhase = summary.phases.find((p) => p.phase === "monitors");
  if (monitorsPhase && monitorsPhase.resources.length > 0) {
    const maxMonitors = config.limits.monitors;
    const existingMonitors = await db
      .select()
      .from(monitor)
      .where(eq(monitor.workspaceId, config.workspaceId))
      .all();
    const remaining = maxMonitors - existingMonitors.length;
    if (remaining <= 0) {
      summary.errors.push(
        `Monitor limit reached (${maxMonitors}). Upgrade your plan to import monitors.`,
      );
    } else if (monitorsPhase.resources.length > remaining) {
      summary.errors.push(
        `Only ${remaining} of ${monitorsPhase.resources.length} monitors can be imported due to plan limit (${maxMonitors}).`,
      );
    }
  }

  // 4. Subscribers
  if (!config.limits["status-subscribers"]) {
    const subscribersPhase = summary.phases.find(
      (p) => p.phase === "subscribers",
    );
    if (subscribersPhase && subscribersPhase.resources.length > 0) {
      summary.errors.push(
        "Subscribers cannot be imported on your current plan. Upgrade to enable status page subscribers.",
      );
    }
  }
}

export async function previewImport(config: {
  provider: string;
  apiKey: string;
  statuspagePageId?: string;
  betterstackStatusPageId?: string;
  workspaceId: number;
  pageId?: number;
  limits: Limits;
}): Promise<ImportSummary> {
  const provider = createProvider(config.provider, config);

  const validation = await provider.validate({
    ...config,
    dryRun: true,
  });
  if (!validation.valid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Provider validation failed: ${validation.error}`,
    });
  }

  const summary = await provider.run({ ...config, dryRun: true });
  await addLimitWarnings(summary, config);
  return summary;
}

export async function runImport(config: {
  provider: string;
  apiKey: string;
  statuspagePageId?: string;
  betterstackStatusPageId?: string;
  workspaceId: number;
  pageId?: number;
  options?: ImportOptions;
  limits: Limits;
}): Promise<ImportSummary> {
  const provider = createProvider(config.provider, config);

  const validation = await provider.validate(config);
  if (!validation.valid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Provider validation failed: ${validation.error}`,
    });
  }

  // Fetch and map all data
  const summary = await provider.run(config);

  // Add limit warnings (same as preview)
  await addLimitWarnings(summary, config);

  // Now write to DB phase by phase
  const idMaps = {
    groups: new Map<string, number>(), // sourceId -> openstatusId
    components: new Map<string, number>(), // sourceId -> openstatusId
    monitors: new Map<string, number>(), // sourceId -> openstatusId
  };

  let targetPageId = config.pageId;
  let phaseAborted = false;

  for (const phase of summary.phases) {
    if (phaseAborted) {
      phase.status = "skipped";
      continue;
    }

    try {
      switch (phase.phase) {
        case "monitors":
          if (config.options?.includeMonitors !== false) {
            await writeMonitorsPhase(
              phase,
              config.workspaceId,
              idMaps.monitors,
              config.limits,
            );
          } else {
            phase.status = "skipped";
          }
          break;
        case "page":
          targetPageId = await writePagePhase(
            phase,
            config.workspaceId,
            config.pageId,
            config.limits,
          );
          break;
        case "monitorGroups":
        case "componentGroups":
          if (targetPageId && config.options?.includeComponents !== false) {
            await writeComponentGroupsPhase(
              phase,
              config.workspaceId,
              targetPageId,
              idMaps.groups,
            );
          } else if (config.options?.includeComponents === false) {
            phase.status = "skipped";
          }
          break;
        case "sections":
          if (targetPageId && config.options?.includeComponents !== false) {
            await writeComponentGroupsPhase(
              phase,
              config.workspaceId,
              targetPageId,
              idMaps.groups,
            );
          } else if (config.options?.includeComponents === false) {
            phase.status = "skipped";
          }
          break;
        case "components":
          if (targetPageId && config.options?.includeComponents !== false) {
            // Check page-components limit
            const existingCount = await db
              .select()
              .from(pageComponent)
              .where(
                and(
                  eq(pageComponent.pageId, targetPageId),
                  eq(pageComponent.workspaceId, config.workspaceId),
                ),
              )
              .all();
            const maxComponents = config.limits["page-components"];
            const remaining = maxComponents - existingCount.length;
            if (remaining <= 0) {
              phase.status = "failed";
              break;
            }
            if (phase.resources.length > remaining) {
              // Trim resources to fit within limit
              const skipped = phase.resources.splice(remaining);
              for (const r of skipped) {
                r.status = "skipped";
                r.error = `Skipped: would exceed component limit (${maxComponents})`;
              }
              phase.resources.push(...skipped);
            }
            await writeComponentsPhase(
              phase,
              config.workspaceId,
              targetPageId,
              idMaps.groups,
              idMaps.components,
            );
          } else if (config.options?.includeComponents === false) {
            phase.status = "skipped";
          }
          break;
        case "incidents":
          if (targetPageId && config.options?.includeStatusReports !== false) {
            await writeIncidentsPhase(
              phase,
              config.workspaceId,
              targetPageId,
              idMaps.components,
            );
          } else if (config.options?.includeStatusReports === false) {
            phase.status = "skipped";
          }
          break;
        case "maintenances":
          if (targetPageId && config.options?.includeStatusReports !== false) {
            await writeMaintenancesPhase(
              phase,
              config.workspaceId,
              targetPageId,
              idMaps.components,
            );
          } else if (config.options?.includeStatusReports === false) {
            phase.status = "skipped";
          }
          break;
        case "subscribers":
          if (targetPageId && config.options?.includeSubscribers) {
            if (!config.limits["status-subscribers"]) {
              phase.status = "skipped";
              break;
            }
            await writeSubscribersPhase(phase, targetPageId, idMaps.components);
          } else {
            phase.status = "skipped";
          }
          break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`Phase "${phase.phase}" failed: ${msg}`);
      phase.status = "failed";
      phaseAborted = true;
    }
  }

  // Compute overall status
  const hasFailures = summary.phases.some((p) => p.status === "failed");
  const hasPartial = summary.phases.some((p) => p.status === "partial");
  const allSkippedOrCompleted = summary.phases.every(
    (p) => p.status === "completed" || p.status === "skipped",
  );

  summary.status = hasFailures
    ? "failed"
    : hasPartial
      ? "partial"
      : allSkippedOrCompleted
        ? "completed"
        : "partial";
  summary.completedAt = new Date();

  return summary;
}

// ---------------------------------------------------------------------------
// Phase writers
// ---------------------------------------------------------------------------

function computePhaseStatus(
  resources: ResourceResult[],
): PhaseResult["status"] {
  if (resources.length === 0) return "completed";
  const allFailed = resources.every((r) => r.status === "failed");
  if (allFailed) return "failed";
  const hasFailed = resources.some((r) => r.status === "failed");
  if (hasFailed) return "partial";
  return "completed";
}

async function writePagePhase(
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

  // Strip custom domain if not allowed by plan
  if (limits && !limits["custom-domain"]) {
    data.customDomain = "";
  }

  // If a page ID was provided, verify and update it
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
    phase.status = "completed";
    return existingPageId;
  }

  // Check idempotency by slug (scoped to workspace)
  const existingBySlug = await db
    .select()
    .from(page)
    .where(and(eq(page.slug, data.slug), eq(page.workspaceId, workspaceId)))
    .get();

  if (existingBySlug) {
    resource.openstatusId = existingBySlug.id;
    resource.status = "skipped";
    phase.status = "completed";
    return existingBySlug.id;
  }

  // Insert new page
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

  if (!inserted) {
    throw new Error("Failed to insert page");
  }

  resource.openstatusId = inserted.id;
  resource.status = "created";
  phase.status = "completed";
  return inserted.id;
}

async function writeComponentGroupsPhase(
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

      // Check idempotency by name + pageId
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
        .values({
          workspaceId,
          pageId,
          name: data.name,
        })
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

async function writeComponentsPhase(
  phase: PhaseResult,
  workspaceId: number,
  pageId: number,
  groupIdMap: Map<string, number>,
  componentIdMap: Map<string, number>,
): Promise<void> {
  for (const resource of phase.resources) {
    if (resource.status === "skipped") continue;

    try {
      const data = resource.data as {
        workspaceId: number;
        pageId: number;
        type: "static";
        monitorId: null;
        name: string;
        description: string | null;
        order: number;
        sourceGroupId: string | null;
      };

      // Check idempotency by name + pageId
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

      // Resolve group ID from source group ID
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

async function writeIncidentsPhase(
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

      // Insert status report
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

      // Insert status report updates
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

      // Link to page components
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

async function writeMaintenancesPhase(
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

      // Insert maintenance
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

      // Link to page components
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

async function writeMonitorsPhase(
  phase: PhaseResult,
  workspaceId: number,
  monitorIdMap: Map<string, number>,
  limits: Limits,
): Promise<void> {
  const existingMonitors = await db
    .select()
    .from(monitor)
    .where(eq(monitor.workspaceId, workspaceId))
    .all();
  const maxMonitors = limits.monitors;
  const remaining = maxMonitors - existingMonitors.length;

  if (remaining <= 0) {
    phase.status = "failed";
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

      // Idempotency check by url + workspaceId
      const existing = await db
        .select()
        .from(monitor)
        .where(
          and(eq(monitor.url, data.url), eq(monitor.workspaceId, workspaceId)),
        )
        .get();

      if (existing) {
        monitorIdMap.set(resource.sourceId, existing.id);
        resource.openstatusId = existing.id;
        resource.status = "skipped";
        continue;
      }

      const [inserted] = await db
        .insert(monitor)
        .values({
          workspaceId,
          jobType: data.jobType as
            | "http"
            | "tcp"
            | "imcp"
            | "udp"
            | "dns"
            | "ssl",
          periodicity: data.periodicity as
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
async function writeSubscribersPhase(
  phase: PhaseResult,
  pageId: number,
  componentIdMap: Map<string, number>,
): Promise<void> {
  for (const resource of phase.resources) {
    try {
      const data = resource.data as {
        email: string;
        pageId: number;
        sourceComponentIds: string[];
      };

      // Idempotency check by email + pageId
      const existing = await db
        .select()
        .from(pageSubscriber)
        .where(
          and(
            eq(pageSubscriber.email, data.email),
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
          email: data.email,
          pageId,
          channelType: "email",
        })
        .returning({ id: pageSubscriber.id });

      if (!inserted) {
        resource.status = "failed";
        resource.error = "Insert returned no result";
        continue;
      }

      // Link to page components
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
