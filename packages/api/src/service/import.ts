import { and, db, eq } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  page,
  pageComponent,
  pageComponentGroup,
  pageSubscriber,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import type {
  ImportSummary,
  PhaseResult,
  ResourceResult,
} from "@openstatus/importers";
import { createStatuspageProvider } from "@openstatus/importers/statuspage";
import { TRPCError } from "@trpc/server";

type ImportOptions = {
  includeIncidents?: boolean;
  includeSubscribers?: boolean;
  includeComponents?: boolean;
};

export async function previewImport(config: {
  apiKey: string;
  statuspagePageId?: string;
  workspaceId: number;
}): Promise<ImportSummary> {
  const provider = createStatuspageProvider();

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

  return provider.run({ ...config, dryRun: true });
}

export async function runImport(config: {
  apiKey: string;
  statuspagePageId?: string;
  workspaceId: number;
  pageId?: number;
  options?: ImportOptions;
  limits: Limits;
}): Promise<ImportSummary> {
  const provider = createStatuspageProvider();

  const validation = await provider.validate(config);
  if (!validation.valid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Provider validation failed: ${validation.error}`,
    });
  }

  // Fetch and map all data
  const summary = await provider.run(config);

  // Now write to DB phase by phase
  const idMaps = {
    groups: new Map<string, number>(), // sourceId -> openstatusId
    components: new Map<string, number>(), // sourceId -> openstatusId
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
        case "page":
          targetPageId = await writePagePhase(
            phase,
            config.workspaceId,
            config.pageId,
            config.limits,
          );
          break;
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
              summary.errors.push(
                `Component limit reached (${maxComponents}). Upgrade your plan to import more components.`,
              );
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
              summary.errors.push(
                `Only ${remaining} of ${remaining + skipped.length} components imported due to plan limit (${maxComponents}).`,
              );
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
          if (targetPageId && config.options?.includeIncidents !== false) {
            await writeIncidentsPhase(
              phase,
              config.workspaceId,
              targetPageId,
              idMaps.components,
            );
          } else if (config.options?.includeIncidents === false) {
            phase.status = "skipped";
          }
          break;
        case "maintenances":
          if (targetPageId && config.options?.includeIncidents !== false) {
            await writeMaintenancesPhase(
              phase,
              config.workspaceId,
              targetPageId,
              idMaps.components,
            );
          } else if (config.options?.includeIncidents === false) {
            phase.status = "skipped";
          }
          break;
        case "subscribers":
          if (targetPageId && config.options?.includeSubscribers) {
            if (!config.limits["status-subscribers"]) {
              phase.status = "skipped";
              summary.errors.push(
                "Subscribers import skipped: upgrade your plan to enable status page subscribers.",
              );
              break;
            }
            await writeSubscribersPhase(phase, targetPageId);
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

  // Check idempotency by slug
  const existingBySlug = await db
    .select()
    .from(page)
    .where(eq(page.slug, data.slug))
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

async function writeSubscribersPhase(
  phase: PhaseResult,
  pageId: number,
): Promise<void> {
  for (const resource of phase.resources) {
    try {
      const data = resource.data as {
        email: string;
        pageId: number;
        channelType: string;
        webhookUrl: string | null;
      };

      // Idempotency check by email + pageId for email type,
      // or webhookUrl + pageId for webhook type
      if (data.channelType === "email") {
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

        resource.openstatusId = inserted.id;
        resource.status = "created";
      } else if (data.channelType === "webhook" && data.webhookUrl) {
        const existing = await db
          .select()
          .from(pageSubscriber)
          .where(
            and(
              eq(pageSubscriber.webhookUrl, data.webhookUrl),
              eq(pageSubscriber.pageId, pageId),
              eq(pageSubscriber.channelType, "webhook"),
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
            channelType: "webhook",
            webhookUrl: data.webhookUrl,
          })
          .returning({ id: pageSubscriber.id });

        if (!inserted) {
          resource.status = "failed";
          resource.error = "Insert returned no result";
          continue;
        }

        resource.openstatusId = inserted.id;
        resource.status = "created";
      } else {
        resource.status = "skipped";
      }
    } catch (err) {
      resource.status = "failed";
      resource.error = err instanceof Error ? err.message : String(err);
    }
  }

  phase.status = computePhaseStatus(phase.resources);
}
