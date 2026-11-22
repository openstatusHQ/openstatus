import {
  LEGACY_IMPACT_WEIGHT,
  impactUptimeWeight,
} from "@openstatus/db/src/schema/page_components/constants";

import { impactConfig } from "@/data/status-report-updates.client";

export const UPTIME_MODE_VALUES = [
  "requests",
  "runs",
  "duration",
  "manual",
] as const;
export type UptimeMode = (typeof UPTIME_MODE_VALUES)[number];

export const UPTIME_DOCS_URL =
  "https://www.openstatus.dev/docs/concept/uptime-calculation-and-values";

// UI labels only - the stored enum values stay `absolute`/`manual` and
// `duration`/`requests`/`runs`/`manual` (DB, API and URL params).
export const configurationLabels = {
  type: {
    absolute: "Monitor checks",
    manual: "Reports only",
  },
  value: {
    duration: "Time per status",
    requests: "Number of requests",
    runs: "Number of runs",
    manual: "Worst status of the day",
  },
} as const;

export function uptimeModeOf(
  type: string | null | undefined,
  value: string | null | undefined,
): UptimeMode {
  if (type === "manual") return "manual";
  if (value === "duration" || value === "runs") return value;
  return "requests";
}

export const UPTIME_MODES: {
  value: UptimeMode;
  label: string;
  meaning: string;
}[] = [
  {
    value: "requests",
    label: configurationLabels.value.requests,
    meaning: "Every check from every region counts.",
  },
  {
    value: "runs",
    label: configurationLabels.value.runs,
    meaning:
      "Each scheduled check counts once. It is down when at least half the cloud regions that reported fail.",
  },
  {
    value: "duration",
    label: configurationLabels.value.duration,
    meaning: "Time lost to outages and impact-weighted status reports.",
  },
  {
    value: "manual",
    label: configurationLabels.type.manual,
    meaning: "Only status reports count. Monitor checks are ignored.",
  },
];

const HEARTBEAT =
  "Time since the day of the first ping, minus outages and impact-weighted status reports. Excused outages count as up.";
const STATIC = "Time minus impact-weighted status reports.";

export const COMPONENT_RULES: Record<
  UptimeMode,
  { label: string; rule: string }[]
> = {
  requests: [
    {
      label: "Monitor",
      rule: "Successful and degraded checks out of all checks, private locations included. Excused outages still count.",
    },
    { label: "Heartbeat monitor", rule: HEARTBEAT },
    { label: "Static", rule: STATIC },
  ],
  runs: [
    {
      label: "Monitor",
      rule: "Successful and degraded runs out of all runs. Excused outages still count.",
    },
    {
      label: "Private locations only",
      rule: "Has no runs, so it is counted in requests.",
    },
    { label: "Heartbeat monitor", rule: HEARTBEAT },
    { label: "Static", rule: STATIC },
  ],
  duration: [
    {
      label: "Monitor",
      rule: "Time on days with checks, minus outages and impact-weighted status reports. Excused outages count as up.",
    },
    { label: "Heartbeat monitor", rule: HEARTBEAT },
    { label: "Static", rule: STATIC },
  ],
  manual: [
    {
      label: "Monitor",
      rule: "Time minus impact-weighted status reports. Months without checks show no data.",
    },
    {
      label: "Heartbeat monitor",
      rule: "Time since the day of the first ping, minus impact-weighted status reports.",
    },
    { label: "Static", rule: STATIC },
  ],
};

export const IMPACT_WEIGHTS = [
  {
    label: impactConfig.major_outage.label,
    weight: impactUptimeWeight("major_outage"),
    hint: "All of its time is downtime.",
  },
  {
    label: impactConfig.partial_outage.label,
    weight: impactUptimeWeight("partial_outage"),
    hint: "Some users affected.",
  },
  {
    label: impactConfig.degraded_performance.label,
    weight: impactUptimeWeight("degraded_performance"),
    hint: "Slow but available.",
  },
  {
    label: "No impact set",
    weight: LEGACY_IMPACT_WEIGHT,
    hint: "Counts fully for static components and on Reports only pages. Ignored for monitors under Time per status, where their outages decide.",
  },
];

/** How an excused outage counts, short enough for an event row. */
export const EXCUSE_EFFECT_SHORT: Record<UptimeMode, string> = {
  requests: "still counts",
  runs: "still counts",
  duration: "counts as up",
  manual: "not counted",
};

export const EXCUSE_EFFECT: Record<UptimeMode, string> = {
  requests:
    "Its failed checks still count, so Number of requests does not change.",
  runs: "Its failed checks still count, so Number of runs does not change.",
  duration: "It then counts as up.",
  manual: "Outages do not count under Reports only, so uptime does not change.",
};
