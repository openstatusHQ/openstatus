import { and, count, db as defaultDb, eq, isNull } from "@openstatus/db";
import { monitor, pageComponent } from "@openstatus/db/src/schema";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import type { ImportSummary } from "@openstatus/importers";

import type { DB } from "../context";
import type { ImportOptions } from "./schemas";

/**
 * Inspect an `ImportSummary` and push per-limit warning strings into
 * `summary.errors`. Shared by `preview` (to surface warnings upfront) and
 * `run` (re-emitted alongside the actual writes). Pure: no mutations to
 * the DB, only to the summary argument.
 *
 * `options` gates the per-phase warnings against the same include flags
 * `run` uses — without this, a user importing with `includeSubscribers:
 * false` on a plan that disables subscribers would see a misleading
 * "subscribers cannot be imported" warning even though the phase is
 * opted out anyway. Defaults mirror `ImportOptions` defaults
 * (status reports on, subscribers off, components on, monitors on).
 */
export async function addLimitWarnings(
  summary: ImportSummary,
  config: {
    limits: Limits;
    workspaceId: number;
    pageId?: number;
    db?: DB;
    options?: Partial<ImportOptions>;
  },
): Promise<void> {
  const db = config.db ?? defaultDb;
  const includeComponents = config.options?.includeComponents ?? true;
  const includeMonitors = config.options?.includeMonitors ?? true;
  const includeSubscribers = config.options?.includeSubscribers ?? false;

  // 1. Page component count
  //
  // `page-components` is a **workspace-wide** plan cap — the
  // `page-component/update-order` service enforces it by counting
  // every component across every page, not just the target one. This
  // preview warning has to match that scope, otherwise imports into
  // an empty page with plenty of workspace-wide pressure would look
  // safe here and blow up at insert time.
  const componentsPhase = summary.phases.find((p) => p.phase === "components");
  if (
    includeComponents &&
    componentsPhase &&
    componentsPhase.resources.length > 0
  ) {
    const maxComponents = config.limits["page-components"];
    const [result] = await db
      .select({ count: count() })
      .from(pageComponent)
      .where(eq(pageComponent.workspaceId, config.workspaceId));
    const existingCount = result?.count ?? 0;
    const remaining = maxComponents - existingCount;
    if (remaining <= 0) {
      summary.errors.push(
        `Component limit reached (${maxComponents}). Upgrade your plan to import components.`,
      );
    } else if (componentsPhase.resources.length > remaining) {
      // Worst-case warning: resource count includes items that will be
      // skipped as duplicates (phase writers dedupe by name + pageId at
      // insert time). Phrased as "up to N new" so the number is an
      // upper bound on quota consumption, not a guaranteed rejection
      // count. Exact new-vs-duplicate split requires a per-component
      // existence check we skip at preview time to keep the dry-run
      // fast.
      summary.errors.push(
        `Only ${remaining} new component${remaining === 1 ? "" : "s"} may be created due to plan limit (${maxComponents}); some of the ${componentsPhase.resources.length} in the import may already exist and be skipped.`,
      );
    }
  }

  // 2. Custom domain — warn that it'll be stripped, not blocked.
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

  // 3. Monitor count
  const monitorsPhase = summary.phases.find((p) => p.phase === "monitors");
  if (includeMonitors && monitorsPhase && monitorsPhase.resources.length > 0) {
    const maxMonitors = config.limits.monitors;
    const [monitorCount] = await db
      .select({ count: count() })
      .from(monitor)
      .where(
        and(
          eq(monitor.workspaceId, config.workspaceId),
          isNull(monitor.deletedAt),
        ),
      );
    const remaining = maxMonitors - (monitorCount?.count ?? 0);
    if (remaining <= 0) {
      summary.errors.push(
        `Monitor limit reached (${maxMonitors}). Upgrade your plan to import monitors.`,
      );
    } else if (monitorsPhase.resources.length > remaining) {
      // Same worst-case framing as the components warning — phase
      // writers dedupe by url + workspaceId at insert time, so the
      // resource count includes items that will be skipped. The exact
      // new-vs-existing split needs a per-monitor existence check we
      // skip at preview time.
      summary.errors.push(
        `Only ${remaining} new monitor${remaining === 1 ? "" : "s"} may be created due to plan limit (${maxMonitors}); some of the ${monitorsPhase.resources.length} in the import may already exist and be skipped.`,
      );
    }
  }

  // 4. Monitor periodicity clamping
  if (includeMonitors && monitorsPhase && monitorsPhase.resources.length > 0) {
    const allowedPeriodicity: string[] = config.limits.periodicity;
    const clamped = monitorsPhase.resources.filter((r) => {
      const data = r.data as { periodicity?: string } | undefined;
      return (
        data?.periodicity && !allowedPeriodicity.includes(data.periodicity)
      );
    });
    if (clamped.length > 0) {
      summary.errors.push(
        `${clamped.length} monitor${clamped.length === 1 ? "'s" : "s'"} check frequency will be adjusted to fit your plan's allowed intervals.`,
      );
    }
  }

  // 5. Subscribers on plans that disable them
  if (includeSubscribers && !config.limits["status-subscribers"]) {
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
