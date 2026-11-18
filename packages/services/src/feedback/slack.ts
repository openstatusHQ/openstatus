import { env } from "../env";

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
    .map(([label, value]) => `*${label}:* ${value}`);
  lines.push("--------------------------------", `*Message:* ${args.message}`);

  try {
    await fetch(args.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
    });
  } catch (err) {
    console.error("Failed to send feedback to Slack", err);
  }
}
