import { FormDiscord } from "@/components/forms/notifications/form-discord";
import { FormEmail } from "@/components/forms/notifications/form-email";
import { FormNtfy } from "@/components/forms/notifications/form-ntfy";
import { FormOpsGenie } from "@/components/forms/notifications/form-opsgenie";
import { FormPagerDuty } from "@/components/forms/notifications/form-pagerduty";
import { FormSlack } from "@/components/forms/notifications/form-slack";
import { FormSms } from "@/components/forms/notifications/form-sms";
import { FormWebhook } from "@/components/forms/notifications/form-webhook";
import { DiscordIcon } from "@/components/icons/discord";
import { OpsGenieIcon } from "@/components/icons/opsgenie";
import { PagerDutyIcon } from "@/components/icons/pagerduty";
import { SlackIcon } from "@/components/icons/slack";
import {
  BellIcon,
  Mail,
  MessageCircle,
  Pencil,
  Trash2,
  Webhook,
} from "lucide-react";
import { sendTestSlackMessage as sendTestSlack } from "@openstatus/notification-slack";
import { sendTestDiscordMessage as sendTestDiscord } from "@openstatus/notification-discord";
import { sendTest as sendTestWebhook } from "@openstatus/notification-webhook";
import { sendTest as sendTestOpsGenie } from "@openstatus/notification-opsgenie";
import { sendTest as sendTestPagerDuty } from "@openstatus/notification-pagerduty";
import { sendTest as sendTestNtfy } from "@openstatus/notification-ntfy";

export const actions = [
  {
    id: "edit",
    label: "Edit",
    icon: Pencil,
    variant: "default" as const,
  },
  {
    id: "delete",
    label: "Delete",
    icon: Trash2,
    variant: "destructive" as const,
  },
] as const;

export type NotifierAction = (typeof actions)[number];

export const getActions = (
  props: Partial<Record<NotifierAction["id"], () => Promise<void> | void>>
): (NotifierAction & { onClick?: () => Promise<void> | void })[] => {
  return actions.map((action) => ({
    ...action,
    onClick: props[action.id as keyof typeof props],
  }));
};

// List of the notifiers

export const config = {
  slack: {
    icon: SlackIcon,
    label: "Slack",
    form: FormSlack,
    sendTest: sendTestSlack,
  },
  discord: {
    icon: DiscordIcon,
    label: "Discord",
    form: FormDiscord,
    sendTest: sendTestDiscord,
  },
  email: {
    icon: Mail,
    label: "Email",
    form: FormEmail,
    // TODO: add sendTest
    sendTest: undefined,
  },
  sms: {
    icon: MessageCircle,
    label: "SMS",
    form: FormSms,
    // TODO: add sendTest
    sendTest: undefined,
  },
  webhook: {
    icon: Webhook,
    label: "Webhook",
    form: FormWebhook,
    sendTest: sendTestWebhook,
  },
  opsgenie: {
    icon: OpsGenieIcon,
    label: "OpsGenie",
    form: FormOpsGenie,
    sendTest: sendTestOpsGenie,
  },
  pagerduty: {
    icon: PagerDutyIcon,
    label: "PagerDuty",
    form: FormPagerDuty,
    sendTest: sendTestPagerDuty,
  },
  ntfy: {
    icon: BellIcon, // TODO: add svg icon
    label: "Ntfy",
    form: FormNtfy,
    sendTest: sendTestNtfy,
  },
};

export type NotifierProvider = keyof typeof config;
