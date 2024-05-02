import type { Limits } from "./types";

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
        value: "status-subscribers",
        label: "Subscribers",
      },
      {
        value: "custom-domain",
        label: "Custom domain",
      },
      {
        value: "password-protection",
        label: "Private pages",
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
