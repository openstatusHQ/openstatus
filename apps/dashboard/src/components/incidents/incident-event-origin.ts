import type { IncidentEventSource } from "@openstatus/db/src/schema/incidents/constants";

export type EventOrigin = {
  kind: "slack" | "api" | "mcp";
  /** Deep link to the original, e.g. a Slack permalink. */
  href?: string;
};

// Notes mirrored from Slack before `source` existed end with a permalink line.
const FROM_SLACK = /\n\n\[From Slack\]\((https?:\/\/\S+)\)$/;

/**
 * Where an event came from, plus its message without the legacy suffix.
 * Covers rows written before `source` existed (the suffix is the only hint)
 * and rows that carry `source` / `source_ref`; a Slack row without a ref
 * still falls back to the suffix so unbackfilled rows keep their link.
 */
export function eventOrigin(event: {
  type: string;
  source: IncidentEventSource | null;
  sourceRef: string | null;
  message: string | null;
}): { origin?: EventOrigin; message: string | null } {
  // Only Slack wrote the suffix; elsewhere it is the author's own text.
  const legacy =
    event.type === "note" &&
    event.message &&
    (event.source === null || event.source === "slack")
      ? FROM_SLACK.exec(event.message)?.[1]
      : undefined;
  const message = legacy
    ? (event.message?.replace(FROM_SLACK, "") ?? null)
    : event.message;
  switch (event.source) {
    case "slack":
      return {
        origin: { kind: "slack", href: event.sourceRef ?? legacy },
        message,
      };
    case "api":
      return { origin: { kind: "api" }, message };
    case "mcp":
      return { origin: { kind: "mcp" }, message };
    case null:
      return {
        origin: legacy ? { kind: "slack", href: legacy } : undefined,
        message,
      };
    default:
      return { message };
  }
}
