export const pageComponentTypes = ["static", "monitor"] as const;

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

// fraction of an interval counted as downtime in manual-mode uptime
export function impactUptimeWeight(impact: PageComponentImpact): number {
  if (impact === "major_outage" || impact === "partial_outage") return 1;
  return 0; // operational | degraded_performance: available
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
    if (pageComponentImpact.indexOf(impact) > pageComponentImpact.indexOf(worst)) {
      worst = impact;
    }
  }
  return worst;
}
