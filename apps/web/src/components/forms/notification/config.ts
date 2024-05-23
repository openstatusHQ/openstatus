import type {
  InsertNotification,
  NotificationProvider,
} from "@openstatus/db/src/schema";
import { sendTestDiscordMessage } from "@openstatus/notification-discord";
import { sendTestSlackMessage } from "@openstatus/notification-slack";

export function getDefaultProviderData(defaultValues?: InsertNotification) {
  if (!defaultValues?.provider) return ""; // FIXME: input can empty - needs to be undefined
  return JSON.parse(defaultValues?.data || "{}")[defaultValues?.provider];
}

export function setProviderData(provider: NotificationProvider, data: string) {
  return { [provider]: data };
}

export function getProviderMetaData(provider: NotificationProvider) {
  switch (provider) {
    case "email":
      return {
        dataType: "email",
        placeholder: "dev@documenso.com",
        setupDocLink: null,
        sendTest: null,
        plans: ["free", "starter", "pro", "team"],
      };

    case "slack":
      return {
        dataType: "url",
        placeholder: "https://hooks.slack.com/services/xxx...",
        setupDocLink:
          "https://api.slack.com/messaging/webhooks#getting_started",
        sendTest: sendTestSlackMessage,
        plans: ["free", "starter", "pro", "team"],
      };

    case "discord":
      return {
        dataType: "url",
        placeholder: "https://discord.com/api/webhooks/{channelId}/xxx...",
        setupDocLink: "https://support.discord.com/hc/en-us/articles/228383668",
        sendTest: sendTestDiscordMessage,
        plans: ["free", "starter", "pro", "team"],
      };
    case "sms":
      return {
        dataType: "tel",
        placeholder: "+123456789",
        setupDocLink: null,
        sendTest: null,
        plans: ["pro", "team"],
      };

    default:
      return {
        dataType: "url",
        placeholder: "xxxx",
        setupDocLink: `https://docs.openstatus.dev/integrations/${provider}`,
        send: null,
        plans: ["free", "starter", "pro", "team"],
      };
  }
}
