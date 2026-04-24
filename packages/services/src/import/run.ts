import { and, count, db as defaultDb, eq } from "@openstatus/db";
import { page, pageComponent } from "@openstatus/db/src/schema";
import type { ImportSummary } from "@openstatus/importers";

import { emitAudit } from "../audit";
import type { ServiceContext } from "../context";
import { NotFoundError, ValidationError } from "../errors";
import { addLimitWarnings } from "./limits";
import {
  type PhaseContext,
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
 * writes.
 *
 * Audit emission is two-layered:
 *   - Each phase writer emits per-resource rows (`page.create`,
 *     `monitor.create`, etc.) for every resource it actually creates,
 *     matching what the domain services would have emitted for normal
 *     CRUD. Skipped rows have their original create audit already;
 *     failed rows have nothing to attribute.
 *   - One final `import.run` row captures the rollup (status + provider)
 *     so a half-broken import still shows up as a single event without
 *     having to scan per-resource audit.
 */
export async function runImport(args: {
  ctx: ServiceContext;
  input: RunImportInput;
}): Promise<ImportSummary> {
  const { ctx } = args;
  const input = RunImportInput.parse(args.input);
  const tx = ctx.db ?? defaultDb;

  // Verify pageId belongs to the workspace before doing any provider work.
  // Was previously duplicated at the router layer — owning this in the
  // service means all callers (tRPC / Slack / future) get the same check.
  if (input.pageId) {
    const existing = await tx
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
    db: tx,
  });

  const idMaps = {
    groups: new Map<string, number>(),
    components: new Map<string, number>(),
    monitors: new Map<string, number>(),
  };

  const pc: PhaseContext = { ctx, tx, provider: input.provider };

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
            await writeMonitorsPhase(pc, phase, idMaps.monitors);
          } else {
            phase.status = "skipped";
          }
          break;
        case "page":
          targetPageId = await writePagePhase(pc, phase, input.pageId);
          break;
        case "componentGroups":
          if (targetPageId && input.options?.includeComponents !== false) {
            await writeComponentGroupsPhase(
              pc,
              phase,
              targetPageId,
              idMaps.groups,
            );
          } else {
            // Fall-through skip: either `includeComponents === false`
            // (user opt-out) or `targetPageId` is missing (page phase
            // produced nothing). Either way this phase has nothing to do.
            phase.status = "skipped";
          }
          break;
        case "components":
          if (targetPageId && input.options?.includeComponents !== false) {
            // Workspace-wide count — `page-components` is the plan cap
            // across every page in the workspace (see
            // `page-component/update-order`). Scoping to `targetPageId`
            // alone would let an import into an empty page push the
            // workspace past the cap because components on other
            // pages go uncounted.
            const [compCount] = await tx
              .select({ count: count() })
              .from(pageComponent)
              .where(eq(pageComponent.workspaceId, ctx.workspace.id));
            const maxComponents = ctx.workspace.limits["page-components"];
            const remaining = maxComponents - (compCount?.count ?? 0);
            if (remaining <= 0) {
              // Stamp each resource with a skip reason to mirror the
              // `writeMonitorsPhase` pattern — otherwise users see a
              // failed phase with no explanation and stale resource
              // statuses.
              for (const r of phase.resources) {
                r.status = "skipped";
                r.error = `Skipped: component limit reached (${maxComponents})`;
              }
              phase.status = "skipped";
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
              pc,
              phase,
              targetPageId,
              idMaps.groups,
              idMaps.components,
              idMaps.monitors,
            );
          } else {
            phase.status = "skipped";
          }
          break;
        case "incidents":
          if (targetPageId && input.options?.includeStatusReports !== false) {
            await writeIncidentsPhase(
              pc,
              phase,
              targetPageId,
              idMaps.components,
            );
          } else {
            phase.status = "skipped";
          }
          break;
        case "maintenances":
          if (targetPageId && input.options?.includeStatusReports !== false) {
            await writeMaintenancesPhase(
              pc,
              phase,
              targetPageId,
              idMaps.components,
            );
          } else {
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
              pc,
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

  // Rollup audit: per-resource rows live inside each phase writer; this
  // row summarises the whole run so partial/failed imports still fire
  // the observability signal without scanning the full summary blob.
  //
  // Entity attribution matches what the run actually touched. When a
  // page was created or reused (`targetPageId` is set) the row points
  // at it; when the page phase failed early and no page is in play we
  // fall back to the workspace so the audit never carries a ghost
  // `page 0` reference that breaks downstream "find audits for this
  // entity" queries.
  await emitAudit(
    tx,
    ctx,
    targetPageId
      ? {
          action: "import.run",
          entityType: "page",
          entityId: targetPageId,
          metadata: {
            provider: input.provider,
            status: summary.status,
            pageId: targetPageId,
          },
        }
      : {
          action: "import.run",
          entityType: "workspace",
          entityId: ctx.workspace.id,
          metadata: {
            provider: input.provider,
            status: summary.status,
            pageId: null,
          },
        },
  );

  return summary;
}
