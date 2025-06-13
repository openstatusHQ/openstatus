import { FormDiscord } from "@/components/forms/notifier/form-discord";
import { FormSlack } from "@/components/forms/notifier/form-slack";
import { DiscordIcon } from "@/components/icons/discord";
import { SlackIcon } from "@/components/icons/slack";
import { Pencil, Trash2, Mail, MessageCircle, Webhook } from "lucide-react";
import { OpsGenieIcon } from "@/components/icons/opsgenie";
import { PagerDutyIcon } from "@/components/icons/pagerduty";
import { FormEmail } from "@/components/forms/notifier/form-email";
import { FormSms } from "@/components/forms/notifier/form-sms";
import { FormWebhook } from "@/components/forms/notifier/form-webhook";

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
  },
  discord: {
    icon: DiscordIcon,
    label: "Discord",
    form: FormDiscord,
  },
  email: {
    icon: Mail,
    label: "Email",
    form: FormEmail,
  },
  sms: {
    icon: MessageCircle,
    label: "SMS",
    form: FormSms,
  },
  webhook: {
    icon: Webhook,
    label: "Webhook",
    form: FormWebhook,
  },
  opsgenie: {
    icon: OpsGenieIcon,
    label: "OpsGenie",
    form: undefined,
  },
  pagerduty: {
    icon: PagerDutyIcon,
    label: "PagerDuty",
    form: undefined,
  },
};

export type NotifierProvider = keyof typeof config;
