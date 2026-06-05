import { msTeamsDataSchema } from "@openstatus/db/src/schema";
import {
  type NotificationContext,
  buildCommonMessageData,
} from "@openstatus/notification-base";
import { assertSafeUrl } from "@openstatus/utils";
import {
  type AdaptiveCard,
  buildAlertCard,
  buildDegradedCard,
  buildRecoveryCard,
  buildTestCard,
} from "./card";

const postCard = async (
  card: AdaptiveCard,
  webhookUrl: string,
): Promise<void> => {
  if (!webhookUrl || webhookUrl.trim() === "") {
    throw new Error("Microsoft Teams webhook URL is required");
  }

  await assertSafeUrl(webhookUrl);

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: card,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Failed to send Microsoft Teams notification: ${res.status} ${res.statusText}`,
    );
  }
};

export const sendAlert = async (ctx: NotificationContext): Promise<void> => {
  const config = msTeamsDataSchema.parse(JSON.parse(ctx.notification.data));
  const data = buildCommonMessageData(ctx);
  await postCard(buildAlertCard(data), config["ms-teams"].webhookUrl);
};

export const sendRecovery = async (ctx: NotificationContext): Promise<void> => {
  const config = msTeamsDataSchema.parse(JSON.parse(ctx.notification.data));
  const data = buildCommonMessageData(ctx, { incident: ctx.incident });
  await postCard(buildRecoveryCard(data), config["ms-teams"].webhookUrl);
};

export const sendDegraded = async (ctx: NotificationContext): Promise<void> => {
  const config = msTeamsDataSchema.parse(JSON.parse(ctx.notification.data));
  const data = buildCommonMessageData(ctx, { incident: ctx.incident });
  await postCard(buildDegradedCard(data), config["ms-teams"].webhookUrl);
};

export const sendTest = async ({
  webhookUrl,
}: {
  webhookUrl: string;
}): Promise<void> => {
  await postCard(buildTestCard(), webhookUrl);
};
