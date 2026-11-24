import { getLogger } from "@logtape/logtape";
import { EmailClient } from "@openstatus/emails";
import { listSignupEmailsBySlack } from "@openstatus/services/user";

import { env } from "../env";

const logger = getLogger(["workflow", "emails"]);
const email = new EmailClient({ apiKey: env().RESEND_API_KEY });

export async function sendFollowUpEmails() {
  const date1 = new Date();
  date1.setDate(date1.getDate() - 2);
  const date2 = new Date();
  date2.setDate(date2.getDate() - 1);

  const { slack: slackEmails, noSlack: noSlackEmails } =
    await listSignupEmailsBySlack({ from: date1, to: date2 });

  const batchSize = 80;

  for (let i = 0; i < noSlackEmails.length; i += batchSize) {
    const batch = noSlackEmails.slice(i, i + batchSize);
    try {
      await email.sendFollowUpBatched({ to: batch });
    } catch (error) {
      logger.error("Follow-up email batch failed", {
        batch_size: batch.length,
        error_name: error instanceof Error ? error.name : typeof error,
      });
      break;
    }
  }

  for (let i = 0; i < slackEmails.length; i += batchSize) {
    const batch = slackEmails.slice(i, i + batchSize);
    try {
      await email.sendSlackFeedbackBatched({ to: batch });
    } catch (error) {
      logger.error("Slack feedback email batch failed", {
        batch_size: batch.length,
        error_name: error instanceof Error ? error.name : typeof error,
      });
      break;
    }
  }
}
