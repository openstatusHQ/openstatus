import {
  type IncidentSeverity,
  type IncidentSlaNoticeKind,
  type IncidentSlaNoticeType,
  type IncidentSlaResolutionStop,
  type IncidentSlaResponseMet,
  formatIncidentSlaMinutes,
} from "@openstatus/db/src/schema";

export type IncidentSlaNoticeCopyInput = {
  kind: IncidentSlaNoticeKind;
  notice: IncidentSlaNoticeType;
  title: string;
  severity: IncidentSeverity;
  /** The update interval for `update` notices. */
  targetMinutes: number;
  dueAt: Date;
  responseMet: IncidentSlaResponseMet;
  resolutionStop: IncidentSlaResolutionStop;
  /** With a linked status report only its updates restart the interval, not notes. */
  reportLinked?: boolean;
};

/** How a channel renders the incident title and the due time (mrkdwn and Slack dates, or plain text). */
export type IncidentSlaNoticeFormat = {
  strong: (text: string) => string;
  time: (date: Date) => string;
};

export type IncidentSlaNoticeCopy = {
  headline: string;
  body: string;
  /** What meets the timer; null once nothing can still meet it in time. */
  action: string | null;
};

const LABEL: Record<IncidentSlaNoticeKind, string> = {
  response: "Response",
  resolution: "Resolution",
  update: "Update",
};

function action(input: IncidentSlaNoticeCopyInput): string | null {
  const when = input.notice === "warning" ? "before then" : "now";
  if (input.kind === "update") {
    return input.reportLinked
      ? `Post a status report update ${when}.`
      : `Post a status report update or a note ${when}.`;
  }
  if (input.kind === "response") {
    return input.responseMet === "status_report"
      ? `Post a status report update ${when}.`
      : `Acknowledge it ${when}.`;
  }
  if (input.notice === "miss") return null;
  return input.resolutionStop === "mitigated"
    ? "Mitigate or resolve it before then."
    : "Resolve it before then.";
}

/** The wording of every SLA notice, shared by Slack and email. */
export function incidentSlaNoticeCopy(
  input: IncidentSlaNoticeCopyInput,
  format: IncidentSlaNoticeFormat,
): IncidentSlaNoticeCopy {
  const target = formatIncidentSlaMinutes(input.targetMinutes);
  const kind = input.kind;
  const subject = `${format.strong(input.title)} (${input.severity})`;
  const due = format.time(input.dueAt);
  if (kind === "update") {
    return input.notice === "warning"
      ? {
          headline: "Update due soon",
          body: `The next update on ${subject} is due ${due} (every ${target}).`,
          action: action(input),
        }
      : {
          headline: "Update overdue",
          body: `The update on ${subject} was due ${due} (every ${target}).`,
          action: action(input),
        };
  }
  return input.notice === "warning"
    ? {
        headline: `${LABEL[kind]} due soon`,
        body: `${subject} has a ${target} ${kind} target due ${due}.`,
        action: action(input),
      }
    : {
        headline: `${LABEL[kind]} target missed`,
        body: `${subject} missed its ${target} ${kind} target, due ${due}.`,
        action: action(input),
      };
}
