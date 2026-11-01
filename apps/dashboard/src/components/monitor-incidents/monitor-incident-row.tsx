"use client";

import type { RouterOutputs } from "@openstatus/api";

import { StatusDot, type StatusVariant } from "@/components/common/status-dot";
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

const dotVariants = {
  ongoing: "destructive",
  acknowledged: "warning",
  resolved: "default",
} as const satisfies Record<IncidentStatus, StatusVariant>;

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
  const meta = resolvedAt
    ? [
        formatWindow(startedAt, resolvedAt),
        incident.autoResolved ? "auto-resolved" : null,
      ]
    : [
        kind ? (status === "acknowledged" ? "acknowledged" : "down") : null,
        `since ${formatClockOrDay(startedAt)}`,
      ];
  const title = kind ? monitor.name : incident.title || monitor.name;

  return (
    <EventRow>
      <EventRowDate date={startedAt} />
      <EventRowStatus>
        <StatusDot variant={dotVariants[status]} />
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
            .map((item) => (
              <span key={item}>{item}</span>
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
      <EventRowDuration>
        {formatDurationShort(
          (resolvedAt ?? new Date()).getTime() - startedAt.getTime(),
        )}
      </EventRowDuration>
      <EventRowMenu>
        <IncidentRowActions incident={incident} />
      </EventRowMenu>
    </EventRow>
  );
}
