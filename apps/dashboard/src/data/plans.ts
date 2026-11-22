import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import type React from "react";

export const plans = allPlans;

export const planOrder = ["free", "starter", "team", "scale"] as const;

export const config: Record<
  string,
  {
    label: string;
    features: {
      value: keyof Limits;
      label: string;
      description?: React.ReactNode; // tooltip informations
      badge?: string;
      monthly?: boolean;
    }[];
  }
> = {
  monitor: {
    label: "Monitor",
    features: [
      { value: "monitors", label: "Number of monitors" },
      { value: "periodicity", label: "Frequency" },
      { value: "multi-region", label: "Multi-region monitoring" },
      { value: "regions", label: "Total regions" },
      { value: "max-regions", label: "Regions per monitor" },
      { value: "data-retention", label: "Data retention" },
      { value: "response-logs", label: "Response Logs" },
      { value: "private-locations", label: "Private Locations" },
      { value: "otel", label: "OTel Exporter" },
      {
        value: "synthetic-checks",
        label: "Synthetic API Checks",
        monthly: true,
      },
    ],
  },
  alerting: {
    label: "Respond",
    features: [
      {
        value: "notifications",
        label: "Slack, Discord, Email, Webhook, ntfy.sh",
      },
      { value: "pagerduty", label: "PagerDuty" },
      { value: "opsgenie", label: "OpsGenie" },
      { value: "grafana-oncall", label: "Grafana OnCall" },
      { value: "whatsapp", label: "WhatsApp" },
      {
        value: "notification-channels",
        label: "Number of notification channels",
      },
    ],
  },
  communicate: {
    label: "Status Pages",
    features: [
      { value: "status-pages", label: "Number of status pages" },
      { value: "page-components", label: "Number of components" },
      { value: "maintenance", label: "Maintenance status" },
      { value: "uptime-history", label: "Uptime history" },
      { value: "status-subscribers", label: "Subscribers" },
      { value: "slack-agent", label: "Slack Agent" },
      {
        value: "monitor-values-visibility",
        label: "Toggle numbers visibility",
      },
      { value: "custom-domain", label: "Custom domain" },
      { value: "white-label", label: "White Label" },
      { value: "custom-theme", label: "Custom Theme" },
      { value: "i18n", label: "Translations" },
      { value: "timezone", label: "Time zone" },
    ],
  },
  "status-page-audience": {
    label: "Status Page Audience",
    features: [
      { value: "password-protection", label: "Password Protection (Basic)" },
      { value: "email-domain-protection", label: "Magic Link (Auth)" },
      { value: "ip-restriction", label: "IP Restriction" },
    ],
  },
  workspace: {
    label: "Workspace",
    features: [
      { value: "members", label: "Team members" },
      { value: "audit-log", label: "Audit log" },
      { value: "sso", label: "SAML single sign-on" },
    ],
  },
};
