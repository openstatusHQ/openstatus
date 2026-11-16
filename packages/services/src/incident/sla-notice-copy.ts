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
  targetMinutes: number;
  dueAt: Date;
  responseMet: IncidentSlaResponseMet;
  resolutionStop: IncidentSlaResolutionStop;
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
};

function action(input: IncidentSlaNoticeCopyInput): string | null {
  const when = input.notice === "warning" ? "before then" : "now";
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
