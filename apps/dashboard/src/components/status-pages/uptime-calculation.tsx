import { impactUptimeWeight } from "@openstatus/db/src/schema/page_components/constants";
import { Check, Info } from "@openstatus/icons";
import { cn } from "@openstatus/ui/lib/utils";
import type React from "react";

import { Link } from "@/components/common/link";
import { Note } from "@/components/common/note";
import {
  COMPONENT_RULES,
  EXCUSE_EFFECT,
  IMPACT_WEIGHTS,
  UPTIME_DOCS_URL,
  UPTIME_MODES,
  type UptimeMode,
} from "@/data/uptime-calculation.client";

const pct = (weight: number) => `${Math.round(weight * 100)}%`;

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
