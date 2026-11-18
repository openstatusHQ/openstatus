import { env } from "../env";

const SLACK_TIMEOUT_MS = 3_000;

type FeedbackSlackField = [label: string, value: unknown];

/** Best-effort: the feedback row is already stored, so a failed post never throws. */
export async function postFeedbackToSlack(args: {
  webhookUrl: string | undefined;
  message: string;
  fields: FeedbackSlackField[];
}): Promise<void> {
  if (!args.webhookUrl) {
    console.error("Slack feedback webhook not configured.");
    return;
  }
  if (env.NODE_ENV === "development") {
    console.log("feedback.submit", args.fields, args.message);
    return;
  }

  const lines = args.fields
    .filter(
      ([, value]) =>
        value === true ||
        typeof value === "number" ||
        (typeof value === "string" && value !== ""),
    )
    .map(([label, value]) => `*${label}:* ${escapeMrkdwn(String(value))}`);
  lines.push(
    "--------------------------------",
    `*Message:* ${escapeMrkdwn(args.message)}`,
  );

  try {
    const response = await fetch(args.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("Failed to send feedback to Slack", response.status);
    }
  } catch (err) {
    console.error("Failed to send feedback to Slack", err);
  }
}

// Slack reads `<!channel>` and `<@U…>` as mentions; values come from users and agents.
function escapeMrkdwn(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
