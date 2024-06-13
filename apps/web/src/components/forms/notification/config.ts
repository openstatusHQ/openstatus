import type {
  InsertNotification,
  NotificationProvider,
} from "@openstatus/db/src/schema";
import { sendTestDiscordMessage } from "@openstatus/notification-discord";
import { sendTestSlackMessage } from "@openstatus/notification-slack";
import { allPlans, plans } from "@openstatus/plans";

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
        label: "Email",
        dataType: "email",
        placeholder: "dev@documenso.com",
        setupDocLink: null,
        sendTest: null,
        plans: plans,
      };

    case "slack":
      return {
        label: "Slack",
        dataType: "url",
        placeholder: "https://hooks.slack.com/services/xxx...",
        setupDocLink:
          "https://api.slack.com/messaging/webhooks#getting_started",
        sendTest: sendTestSlackMessage,
        plans: plans,
      };

    case "discord":
      return {
        label: "Discord",
        dataType: "url",
        placeholder: "https://discord.com/api/webhooks/{channelId}/xxx...",
        setupDocLink: "https://support.discord.com/hc/en-us/articles/228383668",
        sendTest: sendTestDiscordMessage,
        plans: plans,
      };
    case "sms":
      return {
        label: "SMS",
        dataType: "tel",
        placeholder: "+123456789",
        setupDocLink: null,
        sendTest: null,
        plans: plans.filter((plan) => allPlans[plan].limits.sms),
      };

    default:
      return {
        label: "Webhook",
        dataType: "url",
        placeholder: "xxxx",
        setupDocLink: `https://docs.openstatus.dev/integrations/${provider}`,
        send: null,
        plans: plans,
      };
  }
}
