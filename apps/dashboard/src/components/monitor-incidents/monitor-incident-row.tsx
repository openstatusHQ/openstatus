"use client";

import type { RouterOutputs } from "@openstatus/api";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";

import { StatusBars } from "@/components/common/status-bars";
import type { StatusVariant } from "@/components/common/status-dot";
import {
  EventRow,
  EventRowActions,
  EventRowActor,
  EventRowContent,
  EventRowDate,
  EventRowDuration,
  EventRowMenu,
  EventRowMeta,
  EventRowStatus,
  EventRowTitle,
} from "@/components/content/event-list";
import { IncidentRowActions } from "@/components/data-table/incidents/data-table-row-actions";
import { IncidentActionCell } from "@/components/data-table/overview-events/incident-action-cell";
import { DeclareFromRow } from "@/components/incidents/declare-from-row";
import { downtimeActivity } from "@/data/incidents.client";
import {
  monitorReportHref,
  resolutionLabel,
} from "@/data/monitor-report.client";
import {
  type IncidentStatus,
  getIncidentStatus,
  incidentStatusConfig,
} from "@/data/overview-events.client";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  formatClockOrDay,
  formatDurationShort,
  formatWindow,
} from "@/lib/formatter";

type MonitorIncident = RouterOutputs["monitorIncident"]["list"][number];

const openVariants = {
  ongoing: "destructive",
  acknowledged: "warning",
} as const satisfies Record<Exclude<IncidentStatus, "resolved">, StatusVariant>;

/**
 * A monitor's recorded downtime. On the monitor's own page the title is the
 * entry; with `kind` (a mixed list) it is the monitor, linked.
 */
export function MonitorIncidentRow({
  incident,
  kind = false,
}: {
  incident: MonitorIncident;
  kind?: boolean;
}) {
  const status = getIncidentStatus(incident);
  const { startedAt, resolvedAt, monitor } = incident;
  const when = resolvedAt
    ? formatWindow(startedAt, resolvedAt)
    : `since ${formatClockOrDay(startedAt)}`;
  const meta = [
    // untitled rows already show `when` as the title
    kind || incident.title ? when : null,
    kind && !resolvedAt
      ? status === "acknowledged"
        ? "acknowledged"
        : "down"
      : null,
    // an excused row says who excused it and why; the avatar keeps the resolver
    incident.excusedAt
      ? incident.excusedByUser
        ? `excused by ${incident.excusedByUser.name}`
        : null
      : resolvedAt
        ? resolutionLabel(incident)
        : null,
  ];
  // `when` is local time, which differs between the server render and the browser
  const hydrated = useHydrated();
  const title = kind ? monitor.name : incident.title || (hydrated ? when : "");
  const down = (resolvedAt ?? new Date()).getTime() - startedAt.getTime();
  // bars by time down, same steps as the calendar; open rows keep their status color
  const { level } = downtimeActivity(down);
  // auto-resolved after an acknowledgement: credit whoever acknowledged it
  const actor = incident.resolvedByUser
    ? { user: incident.resolvedByUser, label: "Resolved by" }
    : { user: incident.acknowledgedByUser, label: "Acknowledged by" };
  const excused = incident.excusedAt !== null;
  // excused downtime counts as up, so it drops the failure color
  const variant = excused
    ? "default"
    : status === "resolved"
      ? level === 3
        ? "destructive"
        : "warning"
      : openVariants[status];

  return (
    <EventRow>
      <EventRowDate date={startedAt} />
      <EventRowStatus>
        <StatusBars level={level} variant={variant} />
        {excused ? (
          <ExcusedLabel incident={incident} />
        ) : (
          <span>{kind ? "Downtime" : incidentStatusConfig[status].label}</span>
        )}
      </EventRowStatus>
      <EventRowContent>
        <EventRowTitle
          href={kind ? monitorReportHref(monitor.id) : undefined}
          empty={hydrated ? "No name" : ""}
        >
          {title}
        </EventRowTitle>
        <EventRowMeta>
          {meta
            .filter((item) => item !== null)
            .map((item, i) => (
              <span key={i}>{item}</span>
            ))}
          {incident.excusedReason ? (
            <span title={incident.excusedReason}>{incident.excusedReason}</span>
          ) : null}
        </EventRowMeta>
      </EventRowContent>
      <EventRowActions>
        {resolvedAt ? null : (
          <>
            <IncidentActionCell incident={incident} />
            <DeclareFromRow
              title={`${monitor.name} is down`}
              startedAt={startedAt}
              source={{ type: "monitor_incident", id: incident.id }}
            />
          </>
        )}
      </EventRowActions>
      <EventRowActor actor={actor.user} label={actor.label} optional />
      <EventRowDuration>{formatDurationShort(down)}</EventRowDuration>
      <EventRowMenu>
        <IncidentRowActions incident={incident} />
      </EventRowMenu>
    </EventRow>
  );
}

// The meta line folds away on narrow rows, so the reason has to be reachable here.
function ExcusedLabel({ incident }: { incident: MonitorIncident }) {
  const by = incident.excusedByUser?.name;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="decoration-muted-foreground/50 focus-visible:ring-ring/50 relative z-10 underline decoration-dashed underline-offset-2 outline-none focus-visible:ring-[3px]"
        >
          Excused
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium">{by ? `Excused by ${by}` : "Excused"}</p>
        <p className="break-words whitespace-pre-wrap">
          {incident.excusedReason}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
