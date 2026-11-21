import { impactUptimeWeight } from "@openstatus/db/src/schema/page_components/constants";

import type { UptimeMode } from "@/data/uptime-calculation.client";
import { truncatePercentage } from "@/lib/formatter";

export type VariantProps = {
  mode: UptimeMode;
  configurationHref: string;
  timezoneHref: string;
};

const pct = (weight: number) => `${Math.round(weight * 100)}%`;

export const SUMMARY: Record<UptimeMode, string> = {
  requests: "the share of checks that passed, across every region",
  runs: "the share of scheduled runs that passed",
  duration: "the time your components were up",
  manual: "the time not covered by status reports",
};

export type ExampleLine = {
  label: string;
  detail?: string;
  value: string;
  muted?: boolean;
};

export type Example = {
  total: { label: string; value: string };
  lines: ExampleLine[];
  result: string;
};

const MONTH_MIN = 30 * 24 * 60;
const minutes = (n: number) => `${n.toLocaleString("en-US")} min`;
const percent = (part: number, whole: number) =>
  `${truncatePercentage((part / whole) * 100, 2)}%`;

function timeExample(): Example {
  const outage = 120;
  const partial = 240 * impactUptimeWeight("partial_outage");
  const degraded = 360 * impactUptimeWeight("degraded_performance");
  return {
    total: { label: "30-day month", value: minutes(MONTH_MIN) },
    lines: [
      { label: "Monitor outage", detail: "2h", value: `− ${minutes(outage)}` },
      {
        label: "Partial outage report",
        detail: `4h × ${pct(impactUptimeWeight("partial_outage"))}`,
        value: `− ${minutes(partial)}`,
      },
      {
        label: "Degraded performance report",
        detail: `6h × ${pct(impactUptimeWeight("degraded_performance"))}`,
        value: `− ${minutes(degraded)}`,
        muted: true,
      },
      {
        label: "Excused outage",
        detail: "1h",
        value: "counts as up",
        muted: true,
      },
    ],
    result: percent(MONTH_MIN - outage - partial - degraded, MONTH_MIN),
  };
}

function manualExample(): Example {
  const major = 180 * impactUptimeWeight("major_outage");
  const partial = 240 * impactUptimeWeight("partial_outage");
  return {
    total: { label: "30-day month", value: minutes(MONTH_MIN) },
    lines: [
      {
        label: "Major outage report",
        detail: `3h × ${pct(impactUptimeWeight("major_outage"))}`,
        value: `− ${minutes(major)}`,
      },
      {
        label: "Partial outage report",
        detail: `4h × ${pct(impactUptimeWeight("partial_outage"))}`,
        value: `− ${minutes(partial)}`,
      },
      {
        label: "Monitor outage",
        detail: "2h",
        value: "ignored",
        muted: true,
      },
    ],
    result: percent(MONTH_MIN - major - partial, MONTH_MIN),
  };
}

export const EXAMPLE: Record<UptimeMode, Example> = {
  requests: {
    total: { label: "Checks this month", value: "10,000" },
    lines: [
      { label: "Failed checks", detail: "any region", value: "− 12" },
      {
        label: "Degraded checks",
        detail: "slow but answered",
        value: "count as up",
        muted: true,
      },
      {
        label: "Excused outage",
        detail: "its checks",
        value: "still count",
        muted: true,
      },
    ],
    result: percent(10_000 - 12, 10_000),
  },
  runs: {
    total: { label: "Runs this month", value: "1,440" },
    lines: [
      {
        label: "Runs where 3+ of 6 regions failed",
        value: "− 4",
      },
      {
        label: "Runs where 1–2 of 6 regions failed",
        value: "count as up",
        muted: true,
      },
      {
        label: "Excused outage",
        detail: "its runs",
        value: "still count",
        muted: true,
      },
    ],
    result: percent(1_440 - 4, 1_440),
  },
  duration: timeExample(),
  manual: manualExample(),
};

export type Rule = { label: string; weight?: string; note?: string };

const reportsDown: Rule[] = [
  {
    label: "Major outage report",
    weight: pct(impactUptimeWeight("major_outage")),
  },
  {
    label: "Partial outage report",
    weight: pct(impactUptimeWeight("partial_outage")),
  },
];

export const LEDGER: Record<UptimeMode, { down: Rule[]; up: Rule[] }> = {
  requests: {
    down: [
      { label: "Failed check, from any region", weight: "100%" },
      { label: "Excused outage", note: "its checks still count" },
    ],
    up: [
      { label: "Successful check" },
      { label: "Degraded check" },
      { label: "Status reports", note: "only affect static components" },
    ],
  },
  runs: {
    down: [
      { label: "Run where half or more regions failed", weight: "100%" },
      { label: "Excused outage", note: "its runs still count" },
    ],
    up: [
      { label: "Run where fewer than half failed" },
      { label: "Degraded run" },
      { label: "Status reports", note: "only affect static components" },
    ],
  },
  duration: {
    down: [{ label: "Monitor outage", weight: "100%" }, ...reportsDown],
    up: [
      { label: "Degraded performance report" },
      { label: "Excused outage" },
      { label: "Days without checks", note: "not counted at all" },
    ],
  },
  manual: {
    down: reportsDown,
    up: [
      { label: "Degraded performance report" },
      { label: "Monitor outages", note: "ignored" },
    ],
  },
};
