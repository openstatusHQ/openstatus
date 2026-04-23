import { and, count, db as defaultDb, eq } from "@openstatus/db";
import { page, pageComponent } from "@openstatus/db/src/schema";
import type { ImportSummary } from "@openstatus/importers";

import { emitAudit } from "../audit";
import type { ServiceContext } from "../context";
import { NotFoundError, ValidationError } from "../errors";
import { addLimitWarnings } from "./limits";
import {
  writeComponentGroupsPhase,
  writeComponentsPhase,
  writeIncidentsPhase,
  writeMaintenancesPhase,
  writeMonitorsPhase,
  writePagePhase,
  writeSubscribersPhase,
} from "./phase-writers";
import { buildProviderConfig, createProvider } from "./provider";
import { RunImportInput } from "./schemas";

/**
 * Execute a real import: fetches from the provider, validates, applies
 * limit warnings, then walks each phase in sequence writing to the db.
 *
 * The orchestrator is deliberately *not* wrapped in a single
 * `withTransaction`: imports can span many minutes and hold locks across
 * dozens of writes, and the existing UX is phase-level recovery — a
 * failing phase aborts subsequent phases but preserves earlier phases'
 * writes. One audit row is emitted at the end regardless of outcome so
 * the observability signal fires even on partial/failed imports.
 */
export async function runImport(args: {
  ctx: ServiceContext;
  input: RunImportInput;
}): Promise<ImportSummary> {
  const { ctx } = args;
  const input = RunImportInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  // Verify pageId belongs to the workspace before doing any provider work.
  // Was previously duplicated at the router layer — owning this in the
  // service means all callers (tRPC / Slack / future) get the same check.
  if (input.pageId) {
    const existing = await db
      .select({ id: page.id })
      .from(page)
      .where(
        and(eq(page.id, input.pageId), eq(page.workspaceId, ctx.workspace.id)),
      )
      .get();

    if (!existing) throw new NotFoundError("page", input.pageId);
  }

  const provider = createProvider(input.provider);
  const providerConfig = buildProviderConfig({
    provider: input.provider,
    apiKey: input.apiKey,
    statuspagePageId: input.statuspagePageId,
    betterstackStatusPageId: input.betterstackStatusPageId,
    instatusPageId: input.instatusPageId,
    workspaceId: ctx.workspace.id,
    pageId: input.pageId,
  });

  const validation = await provider.validate(providerConfig);
  if (!validation.valid) {
    throw new ValidationError(
      `Provider validation failed: ${validation.error ?? "unknown error"}`,
    );
  }

  const summary = await provider.run(providerConfig);

  await addLimitWarnings(summary, {
    limits: ctx.workspace.limits,
    workspaceId: ctx.workspace.id,
    pageId: input.pageId,
    db,
  });

  const idMaps = {
    groups: new Map<string, number>(),
    components: new Map<string, number>(),
    monitors: new Map<string, number>(),
  };

  let targetPageId = input.pageId;
  let phaseAborted = false;

  for (const phase of summary.phases) {
    if (phaseAborted) {
      phase.status = "skipped";
      continue;
    }

    try {
      switch (phase.phase) {
        case "monitors":
          if (input.options?.includeMonitors !== false) {
            await writeMonitorsPhase(
              db,
              phase,
              ctx.workspace.id,
              idMaps.monitors,
              ctx.workspace.limits,
            );
          } else {
            phase.status = "skipped";
          }
          break;
        case "page":
          targetPageId = await writePagePhase(
            db,
            phase,
            ctx.workspace.id,
            input.pageId,
            ctx.workspace.limits,
          );
          break;
        case "componentGroups":
          if (targetPageId && input.options?.includeComponents !== false) {
            await writeComponentGroupsPhase(
              db,
              phase,
              ctx.workspace.id,
              targetPageId,
              idMaps.groups,
            );
          } else if (input.options?.includeComponents === false) {
            phase.status = "skipped";
          }
          break;
        case "components":
          if (targetPageId && input.options?.includeComponents !== false) {
            const [compCount] = await db
              .select({ count: count() })
              .from(pageComponent)
              .where(
                and(
                  eq(pageComponent.pageId, targetPageId),
                  eq(pageComponent.workspaceId, ctx.workspace.id),
                ),
              );
            const maxComponents = ctx.workspace.limits["page-components"];
            const remaining = maxComponents - (compCount?.count ?? 0);
            if (remaining <= 0) {
              phase.status = "failed";
              break;
            }
            if (phase.resources.length > remaining) {
              // Trim the overflow: mark skipped with a clear error string
              // and keep them in `resources` so the summary still reports
              // them.
              const skipped = phase.resources.splice(remaining);
              for (const r of skipped) {
                r.status = "skipped";
                r.error = `Skipped: would exceed component limit (${maxComponents})`;
              }
              phase.resources.push(...skipped);
            }
            await writeComponentsPhase(
              db,
              phase,
              ctx.workspace.id,
              targetPageId,
              idMaps.groups,
              idMaps.components,
              idMaps.monitors,
            );
          } else if (input.options?.includeComponents === false) {
            phase.status = "skipped";
          }
          break;
        case "incidents":
          if (targetPageId && input.options?.includeStatusReports !== false) {
            await writeIncidentsPhase(
              db,
              phase,
              ctx.workspace.id,
              targetPageId,
              idMaps.components,
            );
          } else if (input.options?.includeStatusReports === false) {
            phase.status = "skipped";
          }
          break;
        case "maintenances":
          if (targetPageId && input.options?.includeStatusReports !== false) {
            await writeMaintenancesPhase(
              db,
              phase,
              ctx.workspace.id,
              targetPageId,
              idMaps.components,
            );
          } else if (input.options?.includeStatusReports === false) {
            phase.status = "skipped";
          }
          break;
        case "subscribers":
          if (targetPageId && input.options?.includeSubscribers) {
            if (!ctx.workspace.limits["status-subscribers"]) {
              phase.status = "skipped";
              break;
            }
            await writeSubscribersPhase(
              db,
              phase,
              targetPageId,
              idMaps.components,
            );
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

  // Import is a write-heavy operation: one audit row regardless of final
  // status so the observability signal fires for partial/failed runs too.
  // Individual per-resource results stay in the returned summary.
  await emitAudit(db, ctx, {
    action: "import.run",
    entityType: "page",
    entityId: targetPageId ?? 0,
    metadata: {
      provider: input.provider,
      status: summary.status,
      pageId: targetPageId,
    },
  });

  return summary;
}
