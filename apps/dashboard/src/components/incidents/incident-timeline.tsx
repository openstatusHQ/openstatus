"use client";

import type { RouterOutputs } from "@openstatus/api";
import {
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
  Incident,
  Linked,
  Lock,
  Plug,
  Unlinked,
} from "@openstatus/icons";
import { SlackIcon } from "@openstatus/icons/brand";
import { personName } from "@openstatus/utils";
import { format } from "date-fns";
import Link from "next/link";

import { ProcessMessage } from "@/components/content/process-message";
import {
  TimelineActor,
  TimelineBody,
  TimelineCard,
  TimelineHeader,
  TimelineHighlight,
  TimelineIndicator,
  TimelineItem,
  TimelineTime,
} from "@/components/content/timeline";

import { IncidentSeverityBadge, IncidentStatusBadge } from "./incident-badge";

type Event = NonNullable<RouterOutputs["incident"]["listEvents"]>[number];
type Incident = NonNullable<RouterOutputs["incident"]["get"]>;

// `team` is optional for app_redirect; without it Slack uses the signed-in one.
function slackChannelUrl(teamId: string | null, channelId: string): string {
  const params = new URLSearchParams({ channel: channelId });
  if (teamId) params.set("team", teamId);
  return `https://slack.com/app_redirect?${params}`;
}

const TRANSITION = /^\w+ changed from \w+ to (\w+)(?:\n\n([\s\S]+))?$/;
const DECLARED = /^Declared as (\w+): /;
const COMMANDER = /^Commander set to (.+)$/;
const STARTED_AT = /^Start time changed to (\S+)$/;
const REPORT = /^(?:Linked|Unlinked) status report #(\d+)$/;
const CHANNEL = /<#([A-Z0-9]+)>/;
// Slack-mirrored notes end with a permalink line appended by the bot.
const FROM_SLACK = /\n\n\[From Slack\]\((https?:\/\/\S+)\)$/;
// Events without a user come from the service itself.
const SYSTEM = { name: "System", email: null };
// Service placeholders when a transition carried no note.
const DEFAULT_NOTES = new Set(["Incident resolved", "Incident canceled"]);

type Parsed = {
  icon: IconType;
  /** The sentence after the actor; `null` for a bare post. */
  phrase: React.ReactNode;
  /** Id read from a linked/unlinked message. */
  reportId?: number;
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  /** Authored text, rendered as a card. */
  message: string | null;
  slackUrl?: string;
  /** Channel id read from a bound/unbound message. */
  channelId?: string;
  /** Message text that already carries the actor's name. */
  agent?: boolean;
};

// Events carry no structured payload, so the subject of a change is read back
// from the service's own message. An unknown shape falls back to the raw text.
function parseEvent(event: Event): Parsed {
  const message = event.message;
  switch (event.type) {
    case "note": {
      const match = message ? FROM_SLACK.exec(message) : null;
      return {
        icon: Chat,
        phrase: null,
        message: message?.replace(FROM_SLACK, "") ?? null,
        slackUrl: match?.[1],
      };
    }
    case "declared": {
      const severity = incidentSeverity.find(
        (s) => s === (message ? DECLARED.exec(message)?.[1] : undefined),
      );
      return {
        icon: Incident,
        phrase: severity ? "declared the incident as" : "declared the incident",
        severity,
        message: severity ? null : message,
      };
    }
    case "status_changed":
    case "mitigated": {
      const match = message ? TRANSITION.exec(message) : null;
      const status = incidentStatus.find((s) => s === match?.[1]);
      return {
        icon: Compare,
        phrase: "marked",
        status:
          status ?? (event.type === "mitigated" ? "mitigated" : undefined),
        message: match ? (match[2] ?? null) : message,
      };
    }
    case "resolved":
    case "canceled":
      return {
        icon: event.type === "resolved" ? Check : Close,
        phrase: "marked",
        status: event.type,
        message: message && !DEFAULT_NOTES.has(message) ? message : null,
      };
    case "severity_changed": {
      const match = message ? TRANSITION.exec(message) : null;
      const severity = incidentSeverity.find((s) => s === match?.[1]);
      return {
        icon: Impact,
        phrase: "changed the severity to",
        severity,
        message: match ? (match[2] ?? null) : message,
      };
    }
    case "commander_changed": {
      const name = message ? COMMANDER.exec(message)?.[1] : undefined;
      return {
        icon: Account,
        phrase: name ? (
          <>
            set the commander to <TimelineHighlight>{name}</TimelineHighlight>
          </>
        ) : (
          "removed the commander"
        ),
        message: null,
      };
    }
    case "started_at_changed": {
      const iso = message ? STARTED_AT.exec(message)?.[1] : undefined;
      const date = iso ? new Date(iso) : null;
      return {
        icon: Clock,
        phrase:
          date && !Number.isNaN(date.getTime()) ? (
            <>
              changed the start time to{" "}
              <TimelineHighlight>
                {format(date, "LLL dd, HH:mm")}
              </TimelineHighlight>
            </>
          ) : (
            "changed the start time"
          ),
        message: null,
      };
    }
    case "status_report_linked":
    case "status_report_unlinked": {
      const id = message ? REPORT.exec(message)?.[1] : undefined;
      const verb =
        event.type === "status_report_linked" ? "linked" : "unlinked";
      return {
        icon: event.type === "status_report_linked" ? Linked : Unlinked,
        phrase: `${verb} status report`,
        reportId: id ? Number(id) : undefined,
        message: null,
      };
    }
    // The message names the channel; the link follows it rather than the
    // incident's current binding, which may be gone or a different channel.
    case "slack_channel_bound":
    case "slack_channel_unbound": {
      const channelId = message ? CHANNEL.exec(message)?.[1] : undefined;
      return {
        icon: Plug,
        phrase:
          event.type === "slack_channel_bound" ? "bound the" : "unbound the",
        message: null,
        channelId,
      };
    }
    case "postmortem_drafted":
    case "postmortem_updated":
    case "postmortem_approved": {
      const agent = message?.includes("by the agent") ?? false;
      const verb =
        event.type === "postmortem_approved"
          ? "approved"
          : event.type === "postmortem_updated"
            ? "edited"
            : agent
              ? "drafted"
              : message?.startsWith("Postmortem draft updated")
                ? "edited"
                : "drafted";
      return {
        icon: FileText,
        phrase: (
          <>
            {verb} the <TimelineHighlight>postmortem</TimelineHighlight>
          </>
        ),
        message: null,
        agent,
      };
    }
    case "closed":
      return { icon: Lock, phrase: "closed the incident", message: null };
  }
}

/**
 * One event as a `TimelineItem`; the page composes the `Timeline` around it.
 * `incident` resolves ids in the message to the report and Slack channel
 * still attached today; older ones stay as plain ids.
 */
export function IncidentTimelineItem({
  event,
  incident,
}: {
  event: Event;
  incident: Pick<Incident, "statusReport" | "slackTeamId">;
}) {
  const {
    icon: Icon,
    phrase,
    status,
    severity,
    message,
    slackUrl,
    channelId,
    agent,
    reportId,
  } = parseEvent(event);
  const user = event.createdByUser;
  const actor = user
    ? { name: personName(user), email: user.email, photoUrl: user.photoUrl }
    : SYSTEM;
  const compact = message === null;
  const report =
    reportId !== undefined && incident.statusReport?.id === reportId
      ? incident.statusReport
      : null;
  const channelUrl =
    event.type === "slack_channel_bound" ||
    event.type === "slack_channel_unbound"
      ? channelId
        ? slackChannelUrl(incident.slackTeamId, channelId)
        : null
      : undefined;

  const sentence = (
    <>
      {agent ? (
        <TimelineHighlight className="in-data-[slot=timeline-card]:font-medium">
          Agent
        </TimelineHighlight>
      ) : (
        <TimelineActor actor={actor} avatar={message !== null} />
      )}
      {slackUrl ? (
        <a
          href={slackUrl}
          target="_blank"
          rel="noreferrer"
          className="decoration-muted-foreground/50 hover:text-foreground inline-flex items-center gap-1 underline decoration-dashed underline-offset-2"
        >
          <SlackIcon className="size-3.5" />
          via Slack
        </a>
      ) : (
        (phrase ?? "posted")
      )}
      {report ? (
        <TimelineHighlight>
          <Link
            href={`/status-pages/${report.pageId}/status-reports/${report.id}`}
            title={report.title}
            className="decoration-muted-foreground/50 hover:text-foreground underline decoration-dashed underline-offset-2"
          >
            #{report.id}
          </Link>
        </TimelineHighlight>
      ) : reportId !== undefined ? (
        <TimelineHighlight>#{reportId}</TimelineHighlight>
      ) : null}
      {channelUrl === undefined ? null : channelUrl ? (
        <TimelineHighlight>
          <a
            href={channelUrl}
            target="_blank"
            rel="noreferrer"
            className="decoration-muted-foreground/50 hover:text-foreground underline decoration-dashed underline-offset-2"
          >
            Slack channel
          </a>
        </TimelineHighlight>
      ) : (
        <TimelineHighlight>Slack channel</TimelineHighlight>
      )}
      {status ? <IncidentStatusBadge status={status} plain={compact} /> : null}
      {severity ? (
        <IncidentSeverityBadge severity={severity} plain={compact} />
      ) : null}
      <TimelineTime date={event.createdAt} />
    </>
  );

  if (compact) {
    return (
      <TimelineItem>
        <TimelineIndicator>
          <Icon />
        </TimelineIndicator>
        <TimelineHeader>{sentence}</TimelineHeader>
      </TimelineItem>
    );
  }
  return (
    <TimelineItem>
      <TimelineCard>
        <TimelineHeader>{sentence}</TimelineHeader>
        <TimelineBody>
          <ProcessMessage value={message} />
        </TimelineBody>
      </TimelineCard>
    </TimelineItem>
  );
}
