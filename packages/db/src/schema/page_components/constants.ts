export const pageComponentTypes = ["static", "monitor", "external"] as const;

export type PageComponentType = (typeof pageComponentTypes)[number];

// ordered worst-last so worstImpact can compare by index
export const pageComponentImpact = [
  "operational",
  "degraded_performance",
  "partial_outage",
  "major_outage",
] as const;

export type PageComponentImpact = (typeof pageComponentImpact)[number];

// legacy report (no impact rows): keep pre-impact behavior — orange, full downtime
export const LEGACY_IMPACT_WEIGHT = 1;

// fraction of an interval counted as downtime in manual-mode uptime.
// partial_outage counts half — some users affected, not all;
// degraded_performance is 0: slow but available ≠ downtime.
export function impactUptimeWeight(impact: PageComponentImpact): number {
  if (impact === "major_outage") return 1;
  if (impact === "partial_outage") return 0.5;
  return 0;
}

// project an impact onto the status-page bar palette
export function impactToStatusType(
  impact: PageComponentImpact,
): "success" | "degraded" | "error" {
  if (impact === "major_outage") return "error";
  if (impact === "operational") return "success";
  return "degraded";
}

export function worstImpact(
  impacts: Iterable<PageComponentImpact>,
): PageComponentImpact {
  let worst: PageComponentImpact = "operational";
  for (const impact of impacts) {
    if (
      pageComponentImpact.indexOf(impact) > pageComponentImpact.indexOf(worst)
    ) {
      worst = impact;
    }
  }
  return worst;
}

/**
 * Current impact per component: the latest update (by date, ties by id)
 * naming it wins. Empty map ⇒ legacy report (no impact rows).
 */
export function currentImpactsFromUpdates(
  updates: ReadonlyArray<{
    id: number;
    date: Date;
    componentImpacts: ReadonlyArray<{
      pageComponentId: number;
      impact: PageComponentImpact;
    }>;
  }>,
): Map<number, PageComponentImpact> {
  const sorted = [...updates].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id,
  );
  const current = new Map<number, PageComponentImpact>();
  for (const update of sorted) {
    for (const row of update.componentImpacts) {
      current.set(row.pageComponentId, row.impact);
    }
  }
  return current;
}
