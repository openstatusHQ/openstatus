"use client";

import { Badge } from "@openstatus/ui/components/ui/badge";
import { cn } from "@openstatus/ui/lib/utils";
import { useParams } from "next/navigation";

import { StatusBars } from "@/components/common/status-bars";
import { StatusDot } from "@/components/common/status-dot";
import {
  EventRow,
  EventRowActions,
  EventRowContent,
  EventRowDate,
  EventRowDuration,
  EventRowMeta,
  EventRowStatus,
  EventRowTitle,
} from "@/components/content/event-list";
import { entityKinds } from "@/data/entity-refs.client";
import { downtimeActivity } from "@/data/incidents.client";
import type { HistoryItem, HistoryItemKind } from "@/data/status-page-history";
import {
  EXCUSE_EFFECT_SHORT,
  type UptimeMode,
} from "@/data/uptime-calculation.client";
import { formatDurationShort, formatWindow } from "@/lib/formatter";

// a hollow dot: the monitor's own window, apart from the page's solid maintenance
const WINDOW_DOT = "border-info border-[1.5px] bg-transparent";

/** One look per kind, shared by the row status, month dots and legend. */
export const historyItemDot: Record<HistoryItemKind, string> = {
  incident: "bg-destructive",
  report: "bg-warning",
  maintenance: "bg-info",
  window: WINDOW_DOT,
  excused: "bg-muted-foreground/50",
};

const durationOf = (item: HistoryItem) =>
  (item.to ?? new Date()).getTime() - item.from.getTime();

/** Same indicator + label as the feature rows with `kind`. */
function HistoryItemStatus({ item }: { item: HistoryItem }) {
  if (item.kind === "window") {
    return (
      <EventRowStatus>
        <StatusDot className={WINDOW_DOT} />
        <span>Window</span>
      </EventRowStatus>
    );
  }
  const { level } = downtimeActivity(durationOf(item));
  if (item.kind === "excused") {
    // excused downtime drops the failure color, like MonitorIncidentRow
    return (
      <EventRowStatus>
        <StatusBars level={level} variant="default" />
        <span>Excused</span>
      </EventRowStatus>
    );
  }
  const { event } = item;
  if (event.type === "maintenance") {
    return (
      <EventRowStatus>
        <StatusDot variant="info" />
        <span>Maintenance</span>
      </EventRowStatus>
    );
  }
  if (event.type === "report") {
    return (
      <EventRowStatus>
        <StatusBars
          level={event.status === "error" ? 3 : 2}
          variant={event.status === "error" ? "destructive" : "warning"}
        />
        <span>Report</span>
      </EventRowStatus>
    );
  }
  return (
    <EventRowStatus>
      <StatusBars
        level={level}
        variant={level === 3 ? "destructive" : "warning"}
      />
      <span>Outage</span>
    </EventRowStatus>
  );
}

function title(item: HistoryItem): string {
  if (item.kind === "event") return item.event.name;
  if (item.kind === "window") return item.window.title;
  // an excused outage has no title; its component is the entry, as on Outages
  return item.components[0] ?? "";
}

function href(item: HistoryItem, pageId: string): string | undefined {
  if (item.kind === "window") return entityKinds.maintenanceWindow.href();
  if (item.kind === "excused" || item.event.type === "incident") {
    return item.monitorId !== null
      ? `/monitors/${item.monitorId}/outages`
      : undefined;
  }
  if (item.event.type === "report") {
    return `/status-pages/${pageId}/status-reports/${item.event.id}`;
  }
  // maintenances have no detail route (sheet-edited on the list page)
  return `/status-pages/${pageId}/maintenances`;
}

export function HistoryItemRow({
  item,
  mode,
}: {
  item: HistoryItem;
  mode: UptimeMode;
}) {
  const { id: pageId } = useParams<{ id: string }>();
  const meta = [
    item.kind === "excused" ? null : item.components.join(", "),
    item.kind === "excused" ? (item.outage.reason ?? "No reason") : null,
    item.kind === "excused" ? EXCUSE_EFFECT_SHORT[mode] : null,
    item.kind === "window"
      ? item.window.mode === "pause"
        ? "checks paused"
        : "alerts muted"
      : null,
    item.to ? formatWindow(item.from, item.to) : "ongoing",
  ].filter((m): m is string => m !== null);

  return (
    <EventRow>
      <EventRowDate date={item.from} />
      <HistoryItemStatus item={item} />
      <EventRowContent>
        <EventRowTitle href={href(item, pageId)}>{title(item)}</EventRowTitle>
        <EventRowMeta>
          {meta.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </EventRowMeta>
      </EventRowContent>
      {item.kind !== "event" ? (
        <EventRowActions>
          <Badge
            variant="outline"
            className="text-muted-foreground font-mono text-[10px] uppercase"
            title="Not shown on the public status page"
          >
            Dashboard only
          </Badge>
        </EventRowActions>
      ) : null}
      <EventRowDuration>
        {formatDurationShort(durationOf(item))}
      </EventRowDuration>
    </EventRow>
  );
}

const LEGEND: { label: string; kinds: [HistoryItemKind, string][] }[] = [
  {
    label: "Public",
    kinds: [
      ["incident", "Outage"],
      ["report", "Status report"],
      ["maintenance", "Maintenance"],
    ],
  },
  {
    label: "Dashboard only",
    kinds: [
      ["excused", "Excused outage"],
      ["window", "Maintenance window"],
    ],
  },
];

export function HistoryItemLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs",
        className,
      )}
    >
      {LEGEND.map((group, i) => (
        <span
          key={group.label}
          className="flex flex-wrap items-center gap-x-3 gap-y-1"
        >
          {i > 0 ? <span aria-hidden className="bg-border h-3 w-px" /> : null}
          <span className="font-mono text-[11px] uppercase">{group.label}</span>
          {group.kinds.map(([kind, label]) => (
            <span key={kind} className="flex items-center gap-1.5">
              <span
                className={cn("size-2 rounded-full", historyItemDot[kind])}
              />
              {label}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}
