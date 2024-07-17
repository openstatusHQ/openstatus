import type { Limits } from "@openstatus/db/src/schema/plan/schema";

export const pricingTableConfig: Record<
  string,
  {
    label: string;
    features: { value: keyof Limits; label: string; badge?: string }[];
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
      { value: "max-regions", label: "Number of Regions" },
      { value: "data-retention", label: "Data retention" },
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
      {
        value: "white-label",
        label: "White Label",
      },
    ],
  },
  alerts: {
    label: "Alerts",
    features: [
      {
        value: "notifications",
        label: "Slack, Discord, Email",
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
