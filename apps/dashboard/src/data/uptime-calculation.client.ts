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

/** Share counted as downtime; "up" and "ignored" are both 0, null is not applicable. */
export type UptimeCell = number | "up" | "ignored" | null;

export const UPTIME_COLUMNS = ["Uptime", "Heartbeat", "Static"] as const;

type Cells = [monitor: UptimeCell, heartbeat: UptimeCell, statik: UptimeCell];

export type UptimeRow = {
  key: string;
  label: string;
  hint?: string;
  cells: Cells;
};

const major = impactUptimeWeight("major_outage");
const partial = impactUptimeWeight("partial_outage");

function monitorRows(
  mode: UptimeMode,
  failed: { label: string; hint: string },
  degraded: string,
): UptimeRow[] {
  const reportsOnly = mode === "manual";
  const perCheck = mode === "requests" || mode === "runs";
  return [
    {
      key: "failed",
      ...failed,
      cells: reportsOnly ? ["ignored", "ignored", null] : [1, 1, null],
    },
    {
      key: "degraded",
      label: degraded,
      hint: "slow",
      cells: [reportsOnly ? "ignored" : "up", null, null],
    },
    {
      key: "excused",
      label: "Excused outage",
      hint: "hidden from the public page",
      cells: reportsOnly
        ? ["ignored", "ignored", null]
        : [perCheck ? 1 : "up", "up", null],
    },
  ];
}

function reportRows(mode: UptimeMode): UptimeRow[] {
  const perCheck = mode === "requests" || mode === "runs";
  const legacy = mode === "manual" ? LEGACY_IMPACT_WEIGHT : "ignored";
  return [
    {
      key: "major_outage",
      label: impactConfig.major_outage.label,
      cells: [perCheck ? "ignored" : major, major, major],
    },
    {
      key: "partial_outage",
      label: impactConfig.partial_outage.label,
      hint: "some users affected",
      cells: [perCheck ? "ignored" : partial, partial, partial],
    },
    {
      key: "degraded_performance",
      label: impactConfig.degraded_performance.label,
      hint: "slow but available",
      cells: [perCheck ? "ignored" : "up", "up", "up"],
    },
    {
      key: "legacy",
      label: "No impact set",
      cells: [legacy, legacy, LEGACY_IMPACT_WEIGHT],
    },
  ];
}

const OUTAGE = { label: "Outage", hint: "failed or missed" };

export const UPTIME_MATRIX: Record<
  UptimeMode,
  { monitors: UptimeRow[]; reports: UptimeRow[]; notes: string[] }
> = {
  requests: {
    monitors: monitorRows(
      "requests",
      { label: "Failed check", hint: "any region, private locations included" },
      "Degraded check",
    ),
    reports: reportRows("requests"),
    notes: [],
  },
  runs: {
    monitors: monitorRows(
      "runs",
      { label: "Failed run", hint: "at least half the cloud regions fail" },
      "Degraded run",
    ),
    reports: reportRows("runs"),
    notes: [
      "Monitors that run only from private locations have no runs and are counted in requests.",
    ],
  },
  duration: {
    monitors: monitorRows("duration", OUTAGE, "Degraded check"),
    reports: reportRows("duration"),
    notes: [],
  },
  manual: {
    monitors: monitorRows("manual", OUTAGE, "Degraded check"),
    reports: reportRows("manual"),
    notes: [
      "Uptime monitor months without checks show no data; heartbeat months count from the first ping, even when silent.",
    ],
  },
};

/** How an excused outage counts, short enough for an event row. */
export const EXCUSE_EFFECT_SHORT: Record<UptimeMode, string> = {
  requests: "still counts",
  runs: "still counts",
  duration: "counts as up",
  manual: "not counted",
};
