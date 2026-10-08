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
import { SlackIcon } from "@openstatus/icons/brand";
import { personName } from "@openstatus/utils";

import type { StatusVariant } from "@/components/common/status-dot";
import { ProcessMessage } from "@/components/content/process-message";
import {
  TimelineActor,
  TimelineActorTooltip,
  TimelineAvatar,
  TimelineAvatarBadge,
  TimelineBody,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineMeta,
  TimelineTime,
  TimelineTitle,
} from "@/components/content/timeline";
import { severityConfig, statusConfig } from "@/data/managed-incidents.client";

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
// Slack-mirrored notes end with a permalink line appended by the bot.
const FROM_SLACK = /\n\n\[From Slack\]\((https?:\/\/\S+)\)$/;

// Events carry no structured payload, so the target of a transition is read
// from the service's own message. An unknown shape falls back to the raw text.
function parseEvent(event: Event): {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  message: string | null;
  slackUrl?: string;
} {
  const message = event.message;
  if (!message) return { message: null };

  if (event.type === "note") {
    const match = FROM_SLACK.exec(message);
    if (match) {
      return { message: message.replace(FROM_SLACK, ""), slackUrl: match[1] };
    }
  }

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

/** One event as a `TimelineItem`; the page composes the `Timeline` around it. */
export function IncidentTimelineItem({ event }: { event: Event }) {
  const config = eventConfig[event.type];
  const { status, severity, message, slackUrl } = parseEvent(event);
  const variant = status
    ? statusConfig[status].variant
    : event.type === "declared" && severity
      ? severityConfig[severity].variant
      : config.variant;
  const user = event.createdByUser;
  const actor = user
    ? { name: personName(user), email: user.email, photoUrl: user.photoUrl }
    : null;
  // Notes are authored, so the author leads the row; state changes keep the
  // colored indicator and show the actor inline.
  const authored = event.type === "note" && actor;
  return (
    <TimelineItem>
      {authored ? (
        <TimelineActorTooltip actor={actor}>
          <TimelineAvatar name={actor.name ?? actor.email} src={actor.photoUrl}>
            <TimelineAvatarBadge variant={variant}>
              <config.icon />
            </TimelineAvatarBadge>
          </TimelineAvatar>
        </TimelineActorTooltip>
      ) : (
        <TimelineIndicator variant={variant}>
          <config.icon />
        </TimelineIndicator>
      )}
      <TimelineContent>
        <TimelineHeader>
          <TimelineTitle>
            {config.label}
            {status ? <IncidentStatusBadge status={status} /> : null}
            {severity ? <IncidentSeverityBadge severity={severity} /> : null}
            {authored ? null : actor ? (
              <TimelineActor actor={actor} />
            ) : (
              <TimelineMeta>System</TimelineMeta>
            )}
            {slackUrl ? (
              <TimelineMeta>
                <a
                  href={slackUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="decoration-muted-foreground/50 hover:text-foreground inline-flex items-center gap-1 underline decoration-dashed underline-offset-2"
                >
                  <SlackIcon className="size-3.5" />
                  via Slack
                </a>
              </TimelineMeta>
            ) : null}
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
}
