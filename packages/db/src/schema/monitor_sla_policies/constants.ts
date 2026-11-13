import { uniqueRegions } from "@openstatus/utils";

/** Monthly uptime targets offered as presets, in thousandths of a percent. */
export const monitorSlaTargetPresets = [
  99_000, 99_500, 99_900, 99_950, 99_990,
] as const;

export const MONITOR_SLA_TARGET_MIN = 1;
export const MONITOR_SLA_TARGET_MAX = 100_000;

/** Floored uptime in thousandths of a percent → `"99.450"`, never rounded up. */
export function formatSlaUptime(uptime: number): string {
  return `${Math.floor(uptime / 1000)}.${String(uptime % 1000).padStart(3, "0")}`;
}

/** Most months one CSV export may span. */
export const MONITOR_SLA_EXPORT_MAX_MONTHS = 60;

/** Monitor types that produce run verdicts, the only thing a policy judges. */
export const monitorSlaJobTypes = [
  "http",
  "tcp",
  "dns",
  "icmp",
  "grpc",
] as const;

/** Why a monitor cannot be under a policy, or null when it can. */
export function monitorSlaIneligibleReason(m: {
  jobType: string;
  regions: string | readonly string[];
}): string | null {
  if (!(monitorSlaJobTypes as readonly string[]).includes(m.jobType)) {
    return `${m.jobType} monitors have no run verdicts`;
  }
  if (uniqueRegions(m.regions).length === 0) {
    return "it runs from private locations only";
  }
  return null;
}

/** Labels for an excused window; the kind never changes the calculation. */
export const monitorSlaExcusedWindowKinds = [
  "maintenance",
  "emergency",
  "third_party",
  "customer_caused",
  "force_majeure",
  "other",
] as const;
export type MonitorSlaExcusedWindowKind =
  (typeof monitorSlaExcusedWindowKinds)[number];

export const MONITOR_SLA_EXCUSED_WINDOW_MAX_MS = 7 * 24 * 3_600_000;
export const MONITOR_SLA_EXCUSED_REASON_MAX = 1_000;

/** How a sealed month was judged: legacy run counts, or time-weighted episodes. */
export const monitorSlaMethods = ["runs", "time"] as const;
export type MonitorSlaMethod = (typeof monitorSlaMethods)[number];

export const monitorSlaEpisodeKinds = [
  "ok",
  "degraded",
  "error",
  "unmeasured",
] as const;
export type MonitorSlaEpisodeKind = (typeof monitorSlaEpisodeKinds)[number];

/** How a sealed episode entered the month's result. */
export const monitorSlaEpisodeTreatments = [
  "counted",
  "excused",
  "lenient",
] as const;
export type MonitorSlaEpisodeTreatment =
  (typeof monitorSlaEpisodeTreatments)[number];
