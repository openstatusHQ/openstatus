// Notes mirrored from Slack before `source` existed end with a permalink line.
const FROM_SLACK = /\n\n\[From Slack\]\((https?:\/\/\S+)\)$/;

/**
 * Lifts a legacy note's "[From Slack](url)" suffix into `source` /
 * `source_ref` and strips it from the message, so readers only see the
 * columns. A Slack row without a ref keeps its suffix link too, in case the
 * backfill has not run. Other rows pass through untouched.
 */
export function withLegacySource<
  T extends {
    type: string;
    source: string | null;
    sourceRef: string | null;
    message: string | null;
  },
>(event: T): T {
  if (event.type !== "note" || !event.message) return event;
  if (event.source !== null && event.source !== "slack") return event;
  const url = FROM_SLACK.exec(event.message)?.[1];
  if (!url) return event;
  return {
    ...event,
    source: "slack",
    sourceRef: event.sourceRef ?? url,
    message: event.message.replace(FROM_SLACK, ""),
  };
}
