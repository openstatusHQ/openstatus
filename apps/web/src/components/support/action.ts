"use server";

import { env } from "@/env";
import type { FormValues } from "./contact-form";

export async function handleSlackWebhookSupport(values: FormValues) {
  console.log(env);
  if (!env.SLACK_SUPPORT_WEBHOOK_URL) return { error: "Missing webhook URL." };

  try {
    await fetch(env.SLACK_SUPPORT_WEBHOOK_URL, {
      method: "POST",
      body: JSON.stringify({
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*New Support Request!* [${process.env.NODE_ENV.toUpperCase()}]\n\n
*Name:* ${values.name}\n
*Type:* ${values.type}\n 
*Blocker:* ${values.blocker ? "Yes" : "No"}\n
*Email:* ${values.email}\n 
*Message:* ${values.message}\n
`,
            },
          },
        ],
      }),
    });
  } catch (e) {
    console.log(e);
    return { error: "Something went wrong. Please try again." };
  }

  return { error: null };
}
