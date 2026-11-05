import {
  StatusEvent,
  StatusEventAffected,
  StatusEventAffectedBadge,
  StatusEventContent,
  StatusEventTimelineReport,
  StatusEventTitle,
  StatusEventTitleCheck,
} from "@openstatus/ui/components/blocks/status-events";

import { demo, getIncident } from "@/data/demo-data";

import {
  Cell,
  CellBody,
  CellDescription,
  CellFooter,
  CellHeader,
  CellRow,
  CellTitle,
} from "./cell";

/** The event as the status page feed renders it, six months later. */
export function StatusReportDemo() {
  const incident = getIncident("resolved");
  return (
    <Cell>
      {/* Event content pulls itself out by 12px/8px; pad so it lands on the cell gutter. */}
      <CellBody className="px-7 py-5">
        <StatusEvent>
          <StatusEventContent hoverable={false}>
            <StatusEventTitle className="flex items-center">
              {incident.title}
              <StatusEventTitleCheck />
            </StatusEventTitle>
            <StatusEventAffected>
              {incident.affected.map((name) => (
                <StatusEventAffectedBadge key={name}>
                  {name}
                </StatusEventAffectedBadge>
              ))}
            </StatusEventAffected>
            <StatusEventTimelineReport updates={incident.updates} />
          </StatusEventContent>
        </StatusEvent>
      </CellBody>
    </Cell>
  );
}

/** The log row behind each step of that report. */
export function AuditDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle>Audit log</CellTitle>
        <CellDescription>{demo.audit.length} events</CellDescription>
      </CellHeader>
      {demo.audit.map((row) => (
        <CellRow
          key={row.time}
          className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-x-3 gap-y-0 py-1.5 text-xs"
        >
          <span className="text-muted-foreground">{row.time}</span>
          <span className="truncate">{row.action}</span>
          <span className="text-muted-foreground truncate text-right">
            {row.actor}
          </span>
          <span className="text-muted-foreground col-span-2 col-start-2 truncate">
            {row.detail}
          </span>
        </CellRow>
      ))}
      <CellFooter>
        <span>Every mutation, with actor and source</span>
        <span>export CSV / JSON</span>
      </CellFooter>
    </Cell>
  );
}
