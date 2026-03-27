import { FormDiscord } from "@/components/forms/notifications/form-discord";
import { FormEmail } from "@/components/forms/notifications/form-email";
import { FormGoogleChat } from "@/components/forms/notifications/form-google-chat";
import { FormGrafanaOncall } from "@/components/forms/notifications/form-grafana-oncall";
import { FormNtfy } from "@/components/forms/notifications/form-ntfy";
import { FormOpsGenie } from "@/components/forms/notifications/form-opsgenie";
import { FormPagerDuty } from "@/components/forms/notifications/form-pagerduty";
import { FormSlack } from "@/components/forms/notifications/form-slack";
import { FormSms } from "@/components/forms/notifications/form-sms";
import { FormTelegram } from "@/components/forms/notifications/form-telegram";
import { FormWebhook } from "@/components/forms/notifications/form-webhook";
import { FormWhatsApp } from "@/components/forms/notifications/form-whatsapp";
import {
  DiscordIcon,
  GoogleIcon,
  GrafanaIcon,
  TelegramIcon,
  WhatsappIcon,
} from "@openstatus/icons";
import { OpsGenieIcon } from "@openstatus/icons";
import { PagerDutyIcon } from "@openstatus/icons";
import { SlackIcon } from "@openstatus/icons";
import {
  BellIcon,
  Cog,
  Mail,
  MessageCircle,
  Trash2,
  Webhook,
} from "lucide-react";

export const actions = [
  {
    id: "edit",
    label: "Settings",
    icon: Cog,
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
  props: Partial<Record<NotifierAction["id"], () => Promise<void> | void>>,
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
    form: FormOpsGenie,
  },
  "google-chat": {
    icon: GoogleIcon,
    label: "Google Chat",
    form: FormGoogleChat,
  },
  "grafana-oncall": {
    icon: GrafanaIcon,
    label: "Grafana OnCall",
    form: FormGrafanaOncall,
  },
  pagerduty: {
    icon: PagerDutyIcon,
    label: "PagerDuty",
    form: FormPagerDuty,
  },
  ntfy: {
    icon: BellIcon, // TODO: add svg icon
    label: "Ntfy",
    form: FormNtfy,
  },
  telegram: {
    icon: TelegramIcon,
    label: "Telegram",
    form: FormTelegram,
  },
  whatsapp: {
    icon: WhatsappIcon,
    label: "WhatsApp",
    form: FormWhatsApp,
  },
};

export type NotifierProvider = keyof typeof config;
