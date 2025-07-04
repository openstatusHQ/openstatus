import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import type React from "react";

export const plans = allPlans;

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
  monitors: {
    label: "Monitors",
    features: [
      {
        value: "periodicity",
        label: "Frequency",
      },
      {
        value: "monitors",
        label: "Number of monitors",
      },
      {
        value: "multi-region",
        label: "Multi-region monitoring",
      },
      { value: "regions", label: "Total regions" },
      { value: "max-regions", label: "Regions per monitor" },
      { value: "data-retention", label: "Data retention" },
      { value: "otel", label: "OTel Exporter" },
      {
        value: "synthetic-checks",
        label: "Synthetic API Checks",
        monthly: true,
      },
    ],
  },
  "status-pages": {
    label: "Status Pages",
    features: [
      {
        value: "status-pages",
        label: "Number of status pages",
      },
      {
        value: "maintenance",
        label: "Maintenance status",
      },
      {
        value: "monitor-values-visibility",
        label: "Toggle numbers visibility",
      },
      {
        value: "status-subscribers",
        label: "Subscribers",
      },
      {
        value: "custom-domain",
        label: "Custom domain",
      },
      {
        value: "password-protection",
        label: "Password-protected",
      },
    ],
  },
  notifiers: {
    label: "Notifiers",
    features: [
      {
        value: "notifications",
        label: "Slack, Discord, Email, Webhook, ntfy.sh",
      },
      {
        value: "sms",
        label: "SMS",
      },
      {
        value: "pagerduty",
        label: "PagerDuty",
      },
      {
        value: "opsgenie",
        label: "OpsGenie",
      },
      {
        value: "notification-channels",
        label: "Number of notification channels",
      },
    ],
  },
  collaboration: {
    label: "Collaboration",
    features: [
      {
        value: "members",
        label: "Team members",
      },
      {
        value: "audit-log",
        label: "Audit log",
        badge: "Planned",
      },
    ],
  },
};
