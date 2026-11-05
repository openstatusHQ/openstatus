import { Button } from "@openstatus/ui/components/ui/button";

import {
  auditRow,
  capitalize,
  demo,
  formatMinutes,
  getResponseEvents,
  hhmm,
  minutesBetween,
} from "@/data/demo-data";

import {
  Cell,
  CellBody,
  CellDescription,
  CellFooter,
  CellGrid,
  CellGridItem,
  CellHeader,
  CellLabel,
  CellMetric,
  CellRow,
  CellSubheader,
  CellTitle,
} from "./cell";

const { response } = demo;
const startedAt = auditRow("monitor.alert").time;
const resolvedAt = auditRow("incident.update", "→ resolved").time;
const duration = formatMinutes(minutesBetween(startedAt, resolvedAt));

/** The incident page in the dashboard: properties on top, the timeline below. */
export function IncidentDemo() {
  const events = getResponseEvents();
  return (
    <Cell>
      <CellHeader>
        <CellTitle>{response.title}</CellTitle>
        <CellDescription>Incident #{response.id}</CellDescription>
      </CellHeader>
      <CellGrid cols={2} sm={4}>
        <CellGridItem>
          <CellLabel>Severity</CellLabel>
          <CellMetric tone="warning">
            {capitalize(response.severity)}
          </CellMetric>
        </CellGridItem>
        <CellGridItem>
          <CellLabel>Status</CellLabel>
          <CellMetric tone="success">Resolved</CellMetric>
        </CellGridItem>
        <CellGridItem>
          <CellLabel>Commander</CellLabel>
          <CellMetric>{response.commander}</CellMetric>
        </CellGridItem>
        <CellGridItem>
          <CellLabel>Duration</CellLabel>
          <CellMetric>{duration}</CellMetric>
        </CellGridItem>
      </CellGrid>
      <CellSubheader>Timeline</CellSubheader>
      {events.map((event) => (
        <CellRow
          key={event.time}
          className="grid grid-cols-[48px_minmax(0,1fr)_auto] gap-x-3 gap-y-0 py-1.5 text-xs"
        >
          <span className="text-muted-foreground">{hhmm(event.time)}</span>
          <span className="truncate">{event.label}</span>
          <span className="text-muted-foreground truncate text-right">
            {event.by}
          </span>
          {event.message ? (
            <span className="text-muted-foreground col-span-2 col-start-2 truncate">
              {event.message}
            </span>
          ) : null}
        </CellRow>
      ))}
      <CellFooter>
        <span>Started {hhmm(startedAt)} UTC, when the monitor alerted</span>
        <span>{events.length} events</span>
      </CellFooter>
    </Cell>
  );
}

/** The agent's draft, in the seven sections every postmortem gets. */
export function PostmortemDemo() {
  const { postmortem } = response;
  const timeline = [...getResponseEvents()]
    .reverse()
    .filter((event) => !event.label.startsWith("Postmortem"));
  const sections = [
    { label: "Summary", text: postmortem.summary },
    {
      label: "Impact",
      text: `Checkout requests routed through Europe failed for ${duration}, from ${hhmm(startedAt)} to ${hhmm(resolvedAt)} UTC. Payments outside Europe were not affected.`,
    },
  ];
  const lessons = [
    { label: "Root cause", text: postmortem.rootCause },
    { label: "What went well", text: postmortem.wentWell },
    { label: "What went wrong", text: postmortem.wentWrong },
  ];
  return (
    <Cell>
      <CellHeader>
        <CellTitle>Postmortem</CellTitle>
        <CellDescription>Draft · drafted by the agent</CellDescription>
      </CellHeader>
      {sections.map((section) => (
        <CellBody key={section.label} className="space-y-1 py-2 text-xs">
          <CellLabel>{section.label}</CellLabel>
          <p className="text-pretty">{section.text}</p>
        </CellBody>
      ))}
      <CellBody className="space-y-1 py-2 text-xs">
        <CellLabel>Timeline</CellLabel>
        <ul>
          {timeline.map((event) => (
            <li key={event.time} className="truncate">
              <span className="text-muted-foreground">
                {hhmm(event.time)} UTC
              </span>{" "}
              {event.label}
            </li>
          ))}
        </ul>
      </CellBody>
      {lessons.map((section) => (
        <CellBody key={section.label} className="space-y-1 py-2 text-xs">
          <CellLabel>{section.label}</CellLabel>
          <p className="text-pretty">{section.text}</p>
        </CellBody>
      ))}
      <CellBody className="space-y-1 py-2 text-xs">
        <CellLabel>Action items</CellLabel>
        <ul>
          {postmortem.actionItems.map((item) => (
            <li key={item}>
              <span className="text-muted-foreground">[ ]</span> {item}
            </li>
          ))}
        </ul>
      </CellBody>
      <CellRow className="flex-wrap justify-start gap-2">
        <Button type="button" size="sm">
          Approve
        </Button>
        <Button type="button" size="sm" variant="outline">
          Draft with agent
        </Button>
      </CellRow>
      <CellFooter>
        <span>
          Built from the timeline, public updates and the Slack channel
        </span>
        <span>Approve, then close the incident</span>
      </CellFooter>
    </Cell>
  );
}
