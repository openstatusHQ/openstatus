"use client";

import { StatusBar } from "@openstatus/ui/components/blocks/status-bar";
import type {
  StatusBarData,
  StatusType,
} from "@openstatus/ui/components/blocks/status.types";
import { systemStatusLabels } from "@openstatus/ui/components/blocks/status.utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import { cn } from "@openstatus/ui/lib/utils";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { ExternalServicePill } from "./external-service-pill";
import { renderIncidentEvent } from "./incident-event";
import {
  type OverlayIncident,
  bucketIncidentsByUtcDay,
} from "./incident-events";

export type ComponentHistoryDay = {
  day: string;
  worstIndicator: string;
  hadMaintenance: number;
  snapshotCount: number;
};

export type ExternalServiceComponentItem = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  groupName?: string | null;
  position: number;
  indicator: string;
  status: string;
  history: ComponentHistoryDay[];
  incidents?: OverlayIncident[];
};

export type ExternalServiceComponentsProps = {
  components: ExternalServiceComponentItem[];
  days: number;
  // When set, each component name links to `${hrefBase}/${slug}`.
  hrefBase?: string;
};

// A lone, short section is worth showing open by default; multi-group or long
// lists (e.g. Cloudflare) stay collapsed so the page doesn't run away.
const AUTO_EXPAND_MAX_COMPONENTS = 10;

const INDICATOR_SEVERITY: Record<string, number> = {
  none: 0,
  minor: 1,
  major: 2,
  critical: 3,
};

function severityOf(indicator: string): number {
  return INDICATOR_SEVERITY[indicator] ?? -1;
}

function isIssue(component: ExternalServiceComponentItem): boolean {
  return severityOf(component.indicator) > 0;
}

// Maintenance maps to indicator "none" (severity 0), so it is not an issue.
// Count it separately or a maintenance-only section reads "All operational".
function isMaintenance(component: ExternalServiceComponentItem): boolean {
  return component.status === "under_maintenance";
}

function indicatorToStatusType(args: {
  worstIndicator: string;
  hadMaintenance: number;
}): StatusType {
  if (args.hadMaintenance) return "info";
  switch (args.worstIndicator) {
    case "none":
      return "success";
    case "minor":
      return "degraded";
    case "major":
    case "critical":
      return "error";
    default:
      return "empty";
  }
}

function buildSeries(
  history: ComponentHistoryDay[],
  days: number,
  incidents?: OverlayIncident[],
): StatusBarData[] {
  const byDay = new Map<string, ComponentHistoryDay>();
  for (const r of history) byDay.set(r.day.slice(0, 10), r);

  const eventsByDay = bucketIncidentsByUtcDay(incidents ?? [], { days });
  const out: StatusBarData[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - i);
    const iso = date.toISOString().slice(0, 10);
    const row = byDay.get(iso);
    const status: StatusType = row
      ? indicatorToStatusType({
          worstIndicator: row.worstIndicator,
          hadMaintenance: row.hadMaintenance,
        })
      : "empty";
    out.push({
      day: iso,
      bar: [{ status, height: 100 }],
      card: [{ status, value: systemStatusLabels[status].short }],
      events: eventsByDay.get(iso) ?? [],
    });
  }
  return out;
}

type Section = {
  key: string;
  // null only for the ungrouped bucket; the label shown depends on whether it
  // is the page's sole section.
  name: string | null;
  components: ExternalServiceComponentItem[];
  worst: number;
};

export function buildSections(
  components: ExternalServiceComponentItem[],
): Section[] {
  const byGroup = new Map<string | null, ExternalServiceComponentItem[]>();
  for (const c of components) {
    const key = c.groupName ?? null;
    const list = byGroup.get(key);
    if (list) list.push(c);
    else byGroup.set(key, [c]);
  }

  const sections: Section[] = [];
  for (const [name, items] of byGroup) {
    const sorted = [...items].sort(
      (a, b) =>
        severityOf(b.indicator) - severityOf(a.indicator) ||
        a.position - b.position ||
        a.name.localeCompare(b.name),
    );
    sections.push({
      // Prefix grouped keys so a real group literally named like the ungrouped
      // sentinel can't collide (grouped keys always start with "group:").
      key: name === null ? "ungrouped" : `group:${name}`,
      name,
      components: sorted,
      worst: sorted.reduce((m, c) => Math.max(m, severityOf(c.indicator)), 0),
    });
  }

  // Named groups worst-first; the ungrouped bucket always trails.
  sections.sort((a, b) => {
    if (a.name === null) return 1;
    if (b.name === null) return -1;
    return b.worst - a.worst || a.name.localeCompare(b.name);
  });
  return sections;
}

function sectionLabel(section: Section, soleSection: boolean): string {
  if (section.name !== null) return section.name;
  return soleSection ? "Components" : "Other";
}

function ComponentRow({
  component,
  days,
  hrefBase,
}: {
  component: ExternalServiceComponentItem;
  days: number;
  hrefBase?: string;
}) {
  const series = buildSeries(component.history, days, component.incidents);
  return (
    <div className="border-border/50 flex flex-col gap-1 border-b py-2 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hrefBase ? (
          <a
            className="text-sm font-medium hover:underline"
            href={`${hrefBase}/${component.slug}`}
          >
            {component.name}
          </a>
        ) : (
          <span className="text-sm font-medium">{component.name}</span>
        )}
        <ExternalServicePill
          indicator={component.indicator}
          status={component.status}
          statusMessage={component.description ?? undefined}
        />
      </div>
      <div className="[&_[data-slot=status-bar-item]]:rounded-none [&_[data-slot=status-bar-item]>div]:rounded-none [&_[data-slot=status-bar-item]>div>div]:rounded-none">
        <StatusBar data={series} renderEvent={renderIncidentEvent} />
      </div>
    </div>
  );
}

function SectionBlock({
  section,
  soleSection,
  days,
  hrefBase,
}: {
  section: Section;
  soleSection: boolean;
  days: number;
  hrefBase?: string;
}) {
  const issues = section.components.filter(isIssue).length;
  const maintenance = section.components.filter(isMaintenance).length;
  const [open, setOpen] = useState(
    soleSection && section.components.length <= AUTO_EXPAND_MAX_COMPONENTS,
  );
  const label = sectionLabel(section, soleSection);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-border border"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
        <span className="flex items-center gap-2 text-sm font-medium">
          {open ? (
            <ChevronDownIcon className="size-4 shrink-0" />
          ) : (
            <ChevronRightIcon className="size-4 shrink-0" />
          )}
          {label}
          <span className="text-muted-foreground">
            ({section.components.length})
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 text-xs",
            issues > 0
              ? "text-destructive"
              : maintenance > 0
                ? "text-info"
                : "text-muted-foreground",
          )}
        >
          {issues > 0
            ? `${issues} issue${issues === 1 ? "" : "s"}`
            : maintenance > 0
              ? `${maintenance} under maintenance`
              : "All operational"}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-2">
        {section.components.map((c) => (
          <ComponentRow
            key={c.id}
            component={c}
            days={days}
            hrefBase={hrefBase}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ExternalServiceComponents({
  components,
  days,
  hrefBase,
}: ExternalServiceComponentsProps) {
  if (components.length === 0) return null;
  const sections = buildSections(components);
  const soleSection = sections.length === 1;

  return (
    <div className="flex flex-col gap-2">
      {sections.map((section) => (
        <SectionBlock
          key={section.key}
          section={section}
          soleSection={soleSection}
          days={days}
          hrefBase={hrefBase}
        />
      ))}
    </div>
  );
}
