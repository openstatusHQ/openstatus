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

/** How a sealed month was judged: time-weighted episodes. */
export const monitorSlaMethods = ["time"] as const;
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

/** A step credit schedule, all in percent: each started `stepPct` below target earns `creditPct` of monthly fees, up to `capPct`. */
export type MonitorSlaCreditSchedule = {
  stepPct: number;
  creditPct: number;
  capPct: number;
};

export type MonitorSlaCredit = {
  /** started steps below target; 0 when met */
  steps: number;
  /** percent of monthly fees, capped */
  pct: number;
};

const thousandths = (pct: number) => BigInt(Math.round(pct * 1000));

/**
 * The credit a month earned from its exact up/total (runs or ms), not the
 * floored uptime; null without a schedule or a judgement.
 */
export function slaCredit(args: {
  up: number;
  total: number;
  target: number;
  schedule: MonitorSlaCreditSchedule | null;
}): MonitorSlaCredit | null {
  const { schedule } = args;
  if (!schedule || args.total <= 0) return null;
  const total = BigInt(args.total);
  // shortfall × total, in thousandths of a percent
  const short = BigInt(args.target) * total - BigInt(args.up) * BigInt(100_000);
  if (short <= BigInt(0)) return { steps: 0, pct: 0 };
  const per = thousandths(schedule.stepPct) * total;
  const steps = (short + per - BigInt(1)) / per;
  const credit = steps * thousandths(schedule.creditPct);
  const cap = thousandths(schedule.capPct);
  return {
    steps: Number(steps),
    pct: Number(credit < cap ? credit : cap) / 1000,
  };
}

export function sameCreditSchedule(
  a: MonitorSlaCreditSchedule | null,
  b: MonitorSlaCreditSchedule | null,
): boolean {
  if (!a || !b) return a === b;
  return (
    a.stepPct === b.stepPct &&
    a.creditPct === b.creditPct &&
    a.capPct === b.capPct
  );
}

/** A credit in percent of fees → `"3.000"`, three decimals like the schedule. */
export function formatSlaCreditPct(pct: number): string {
  return pct.toFixed(3);
}
