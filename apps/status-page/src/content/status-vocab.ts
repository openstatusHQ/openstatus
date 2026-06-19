/**
 * Maps openstatus's internal status vocabulary onto Atlassian Statuspage's
 * de-facto public schema, so agents and tooling that already know that shape
 * work against an openstatus page zero-shot. `page.status` and component
 * `status` are both `success|degraded|error|info` in @openstatus/db; the
 * component-impact enum (`operational|degraded_performance|…`) already matches
 * Statuspage, so only the live rollup needs translating.
 */

export type PageStatus = "success" | "degraded" | "error" | "info";

const PAGE_INDICATOR: Record<
  PageStatus,
  { indicator: string; description: string }
> = {
  success: { indicator: "none", description: "All Systems Operational" },
  degraded: { indicator: "minor", description: "Degraded Performance" },
  error: { indicator: "major", description: "Major Outage" },
  info: { indicator: "maintenance", description: "Under Maintenance" },
};

const COMPONENT_STATUS: Record<PageStatus, string> = {
  success: "operational",
  degraded: "degraded_performance",
  error: "major_outage",
  info: "under_maintenance",
};

const SEVERITY: Record<PageStatus, number> = {
  error: 3,
  degraded: 2,
  info: 1,
  success: 0,
};

/** Statuspage page-level indicator + human description for a live page status. */
export function pageIndicator(status: string): {
  indicator: string;
  description: string;
} {
  return PAGE_INDICATOR[status as PageStatus] ?? PAGE_INDICATOR.success;
}

/** Statuspage component status for a live component status. */
export function componentStatus(status: string): string {
  return COMPONENT_STATUS[status as PageStatus] ?? "operational";
}

type TrackerLike =
  | { type: "component"; component: { name: string; status: string } }
  | { type: "group"; components: { name: string; status: string }[] };

/** Flatten the tracker tree (components + grouped components) to a flat list. */
export function flattenComponents(
  trackers: TrackerLike[] | null | undefined,
): { name: string; status: string }[] {
  const out: { name: string; status: string }[] = [];
  for (const t of trackers ?? []) {
    if (t.type === "component") {
      out.push({ name: t.component.name, status: t.component.status });
    } else {
      for (const c of t.components)
        out.push({ name: c.name, status: c.status });
    }
  }
  return out;
}

/** Name of the most severely impacted component, or null if all operational. */
export function worstComponent(
  components: { name: string; status: string }[],
): string | null {
  let worst: { name: string; rank: number } | null = null;
  for (const c of components) {
    const rank = SEVERITY[c.status as PageStatus] ?? 0;
    if (rank > 0 && (worst === null || rank > worst.rank)) {
      worst = { name: c.name, rank };
    }
  }
  return worst?.name ?? null;
}

/** ISO-8601 (RFC3339) timestamp, or null — for machine-facing JSON. */
export function isoOrNull(
  date: Date | string | number | null | undefined,
): string | null {
  if (date === null || date === undefined) return null;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
