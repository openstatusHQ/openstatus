import type { PhaseResult, ResourceResult } from "@openstatus/importers";

/**
 * Ordered periodicity tiers from fastest to slowest — `clampPeriodicity`
 * walks this to find the nearest allowed slower value.
 */
export const PERIODICITY_ORDER = [
  "30s",
  "1m",
  "5m",
  "10m",
  "30m",
  "1h",
] as const;

/**
 * Map a requested periodicity to the closest value the plan allows, never
 * faster than the request. Falls back to the slowest allowed value when
 * no slower tier is available.
 */
export function clampPeriodicity(requested: string, allowed: string[]): string {
  if (allowed.includes(requested)) return requested;
  const reqIdx = PERIODICITY_ORDER.indexOf(
    requested as (typeof PERIODICITY_ORDER)[number],
  );
  for (let i = Math.max(reqIdx, 0); i < PERIODICITY_ORDER.length; i++) {
    if (allowed.includes(PERIODICITY_ORDER[i])) {
      return PERIODICITY_ORDER[i];
    }
  }
  return allowed[allowed.length - 1] ?? "10m";
}

/**
 * Roll up the per-resource statuses in a phase into the phase-level
 * status. Empty phases are `completed`; all-failed is `failed`; any mix
 * of failed/skipped with successes is `partial`.
 */
export function computePhaseStatus(
  resources: ResourceResult[],
): PhaseResult["status"] {
  if (resources.length === 0) return "completed";

  const allFailed = resources.every((r) => r.status === "failed");
  if (allFailed) return "failed";

  const hasFailed = resources.some((r) => r.status === "failed");
  const hasSkipped = resources.some((r) => r.status === "skipped");
  const allSkipped = resources.every((r) => r.status === "skipped");

  if (hasFailed || (hasSkipped && !allSkipped)) return "partial";

  return "completed";
}
