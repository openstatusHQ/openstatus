"use client";

import type { RouterOutputs } from "@openstatus/api";

import { StatusBars } from "@/components/common/status-bars";
import type { StatusVariant } from "@/components/common/status-dot";
import {
  EventRow,
  EventRowActions,
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
  type IncidentStatus,
  getIncidentStatus,
  incidentStatusConfig,
} from "@/data/overview-events.client";
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
    resolvedAt && incident.autoResolved ? "auto-resolved" : null,
  ];
  const title = kind ? monitor.name : incident.title || when;
  const down = (resolvedAt ?? new Date()).getTime() - startedAt.getTime();
  // bars by time down, same steps as the calendar; open rows keep their status color
  const { level } = downtimeActivity(down);
  const variant =
    status === "resolved"
      ? level === 3
        ? "destructive"
        : "warning"
      : openVariants[status];

  return (
    <EventRow>
      <EventRowDate date={startedAt} />
      <EventRowStatus>
        <StatusBars level={level} variant={variant} />
        <span>{kind ? "Downtime" : incidentStatusConfig[status].label}</span>
      </EventRowStatus>
      <EventRowContent>
        <EventRowTitle
          href={kind ? `/monitors/${monitor.id}/incidents` : undefined}
          empty="No name"
        >
          {title}
        </EventRowTitle>
        <EventRowMeta>
          {meta
            .filter((item) => item !== null)
            .map((item, i) => (
              <span key={i}>{item}</span>
            ))}
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
      <EventRowDuration>{formatDurationShort(down)}</EventRowDuration>
      <EventRowMenu>
        <IncidentRowActions incident={incident} />
      </EventRowMenu>
    </EventRow>
  );
}
