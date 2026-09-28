"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { IncidentEventType } from "@openstatus/db/src/schema/incidents/constants";
import { formatDistanceToNow } from "date-fns";

import { ProcessMessage } from "@/components/content/process-message";
import { personName } from "@/data/managed-incidents.client";

type Event = NonNullable<RouterOutputs["incident"]["listEvents"]>[number];

const labels: Record<IncidentEventType, string> = {
  declared: "Declared",
  severity_changed: "Severity changed",
  status_changed: "Status changed",
  commander_changed: "Commander changed",
  started_at_changed: "Start time changed",
  note: "Note",
  status_report_linked: "Status report linked",
  status_report_unlinked: "Status report unlinked",
  slack_channel_bound: "Slack channel bound",
  slack_channel_unbound: "Slack channel unbound",
  mitigated: "Mitigated",
  resolved: "Resolved",
  canceled: "Canceled",
  postmortem_drafted: "Postmortem drafted",
  postmortem_updated: "Postmortem updated",
  postmortem_approved: "Postmortem approved",
  closed: "Closed",
};

export function IncidentTimeline({ events }: { events: Event[] }) {
  if (events.length === 0) return null;
  return (
    <ol className="grid gap-4">
      {events.map((event) => (
        <li key={event.id} className="grid gap-1 border-l-2 pl-3">
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
            <span className="text-foreground font-medium">
              {labels[event.type]}
            </span>
            <span>·</span>
            <span>{personName(event.createdByUser) ?? "System"}</span>
            <span>·</span>
            <time
              dateTime={event.createdAt.toISOString()}
              title={event.createdAt.toLocaleString()}
            >
              {formatDistanceToNow(event.createdAt, { addSuffix: true })}
            </time>
          </div>
          {event.message ? (
            <div className="prose dark:prose-invert prose-sm max-w-none">
              <ProcessMessage value={event.message} />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
