import {
  LEGACY_IMPACT_WEIGHT,
  impactUptimeWeight,
} from "@openstatus/db/src/schema/page_components/constants";
import { Check, Info } from "@openstatus/icons";
import { cn } from "@openstatus/ui/lib/utils";
import type React from "react";

import { Link } from "@/components/common/link";
import { Note } from "@/components/common/note";
import { impactConfig } from "@/data/status-report-updates.client";

export type UptimeMode = "requests" | "runs" | "duration" | "manual";

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

const pct = (weight: number) => `${Math.round(weight * 100)}%`;

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
      "Each scheduled check counts once. It is down when half its regions fail.",
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
  "Time since the first ping, minus outages and impact-weighted status reports. Excused outages count as up.";
const STATIC = "Time minus impact-weighted status reports.";

const COMPONENT_RULES: Record<UptimeMode, { label: string; rule: string }[]> = {
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
      rule: "Time since the first ping, minus impact-weighted status reports.",
    },
    { label: "Static", rule: STATIC },
  ],
};

const IMPACT_WEIGHTS = [
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

const EXCUSE_EFFECT: Record<UptimeMode, string> = {
  requests:
    "Its failed checks still count, so Number of requests does not change.",
  runs: "Its failed checks still count, so Number of runs does not change.",
  duration: "It then counts as up.",
  manual: "Outages do not count under Reports only, so uptime does not change.",
};

function Tile({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      className={cn("flex flex-col gap-1 rounded-lg border p-3", className)}
      {...props}
    />
  );
}

export function UptimeModeTiles({ mode }: { mode: UptimeMode }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {UPTIME_MODES.map((m) => {
        const active = m.value === mode;
        return (
          <Tile
            key={m.value}
            aria-current={active ? "true" : undefined}
            className={cn(
              "text-sm",
              active ? "border-foreground bg-muted/50" : "border-dashed",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {m.label}
              </span>
              {active ? (
                <span className="text-foreground inline-flex items-center gap-1 font-mono text-xs">
                  <Check className="size-3" />
                  In use
                </span>
              ) : null}
            </div>
            <span className="text-muted-foreground">{m.meaning}</span>
          </Tile>
        );
      })}
    </ul>
  );
}

/** Per-component rules, impact weights and excusing under `mode`. */
export function UptimeCalculation({
  mode,
  className,
}: {
  mode: UptimeMode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 text-sm", className)}>
      <dl className="grid gap-3 sm:grid-cols-[12rem_1fr] sm:gap-x-4">
        {COMPONENT_RULES[mode].map((c) => (
          <div key={c.label} className="contents">
            <dt className="text-foreground font-medium">{c.label}</dt>
            <dd className="text-muted-foreground -mt-2 sm:mt-0">{c.rule}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-2">
        <span className="text-foreground font-medium">
          Status report impact
        </span>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {IMPACT_WEIGHTS.map((i) => (
            <Tile key={i.label}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-foreground font-medium">{i.label}</span>
                <span className="text-foreground font-mono tabular-nums">
                  {pct(i.weight)}
                </span>
              </div>
              <span className="text-muted-foreground">{i.hint}</span>
            </Tile>
          ))}
        </ul>
        <span className="text-muted-foreground">
          The share of a report&apos;s time counted as downtime. Monitor outages
          always count fully.
        </span>
      </div>
      <Note size="sm" className="items-start">
        <Info className="mt-0.5" />
        <span>
          Excuse a resolved outage with a reason in{" "}
          <span className="font-medium">
            Monitor &gt; Report &gt; outage menu &gt; Excuse
          </span>
          . It is hidden from the public page. {EXCUSE_EFFECT[mode]}{" "}
          <Link href={`${UPTIME_DOCS_URL}#excused-outages`}>Learn more</Link>
        </span>
      </Note>
    </div>
  );
}

/** Impact picker hint: what each impact does to the page's uptime. */
export function ImpactUptimeHint() {
  return (
    <>
      Under Time per status a major outage counts{" "}
      {pct(impactUptimeWeight("major_outage"))} of the report's time as
      downtime, a partial outage {pct(impactUptimeWeight("partial_outage"))},
      degraded performance {pct(impactUptimeWeight("degraded_performance"))}.{" "}
      <Link href={`${UPTIME_DOCS_URL}#status-report-impact`}>Learn more</Link>
    </>
  );
}
