"use client";

import type { RouterOutputs } from "@openstatus/api";
import {
  type IncidentEventType,
  type IncidentSeverity,
  type IncidentStatus,
  incidentSeverity,
  incidentStatus,
} from "@openstatus/db/src/schema/incidents/constants";
import {
  Account,
  Chat,
  Check,
  Clock,
  Close,
  Compare,
  FileText,
  type IconType,
  Impact,
  Linked,
  Lock,
  Plug,
  Unlinked,
  Warning,
} from "@openstatus/icons";

import type { StatusVariant } from "@/components/common/status-dot";
import { ProcessMessage } from "@/components/content/process-message";
import {
  Timeline,
  TimelineBody,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineMeta,
  TimelineTime,
  TimelineTitle,
} from "@/components/content/timeline";
import {
  personName,
  severityConfig,
  statusConfig,
} from "@/data/managed-incidents.client";

import { IncidentSeverityBadge, IncidentStatusBadge } from "./incident-badge";

type Event = NonNullable<RouterOutputs["incident"]["listEvents"]>[number];

const eventConfig: Record<
  IncidentEventType,
  { label: string; icon: IconType; variant?: StatusVariant }
> = {
  declared: { label: "Declared", icon: Warning, variant: "warning" },
  severity_changed: { label: "Severity changed", icon: Impact },
  status_changed: { label: "Status changed", icon: Compare },
  commander_changed: { label: "Commander changed", icon: Account },
  started_at_changed: { label: "Start time changed", icon: Clock },
  note: { label: "Note", icon: Chat },
  status_report_linked: { label: "Status report linked", icon: Linked },
  status_report_unlinked: { label: "Status report unlinked", icon: Unlinked },
  slack_channel_bound: { label: "Slack channel bound", icon: Plug },
  slack_channel_unbound: { label: "Slack channel unbound", icon: Plug },
  mitigated: { label: "Mitigated", icon: Check, variant: "warning" },
  resolved: { label: "Resolved", icon: Check, variant: "success" },
  canceled: { label: "Canceled", icon: Close },
  postmortem_drafted: { label: "Postmortem drafted", icon: FileText },
  postmortem_updated: { label: "Postmortem updated", icon: FileText },
  postmortem_approved: {
    label: "Postmortem approved",
    icon: FileText,
    variant: "success",
  },
  closed: { label: "Closed", icon: Lock },
};

const TRANSITION = /^\w+ changed from \w+ to (\w+)(?:\n\n([\s\S]+))?$/;
const DECLARED = /^Declared as (\w+): /;

// Events carry no structured payload, so the target of a transition is read
// from the service's own message. An unknown shape falls back to the raw text.
function parseEvent(event: Event): {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  message: string | null;
} {
  const message = event.message;
  if (!message) return { message: null };

  // The message only repeats the label around a raw Slack channel id.
  if (
    event.type === "slack_channel_bound" ||
    event.type === "slack_channel_unbound"
  ) {
    return { message: null };
  }
  if (event.type === "status_changed") {
    const match = TRANSITION.exec(message);
    const status = incidentStatus.find((s) => s === match?.[1]);
    if (status) return { status, message: match?.[2] ?? null };
  }
  if (event.type === "severity_changed") {
    const match = TRANSITION.exec(message);
    const severity = incidentSeverity.find((s) => s === match?.[1]);
    if (severity) return { severity, message: match?.[2] ?? null };
  }
  if (event.type === "declared") {
    const severity = incidentSeverity.find(
      (s) => s === DECLARED.exec(message)?.[1],
    );
    if (severity) return { severity, message: null };
  }
  return { message };
}

export function IncidentTimeline({ events }: { events: Event[] }) {
  if (events.length === 0) return null;
  return (
    <Timeline>
      {events.map((event) => {
        const config = eventConfig[event.type];
        const { status, severity, message } = parseEvent(event);
        const variant = status
          ? statusConfig[status].variant
          : event.type === "declared" && severity
            ? severityConfig[severity].variant
            : config.variant;
        return (
          <TimelineItem key={event.id}>
            <TimelineIndicator variant={variant}>
              <config.icon />
            </TimelineIndicator>
            <TimelineContent>
              <TimelineHeader>
                <TimelineTitle>
                  {config.label}
                  {status ? <IncidentStatusBadge status={status} /> : null}
                  {severity ? (
                    <IncidentSeverityBadge severity={severity} />
                  ) : null}
                  <TimelineMeta>
                    {personName(event.createdByUser) ?? "System"}
                  </TimelineMeta>
                </TimelineTitle>
                <TimelineTime date={event.createdAt} />
              </TimelineHeader>
              {message ? (
                <TimelineBody className="prose prose-sm dark:prose-invert max-w-none">
                  <ProcessMessage value={message} />
                </TimelineBody>
              ) : null}
            </TimelineContent>
          </TimelineItem>
        );
      })}
    </Timeline>
  );
}
