export const pricingTableConfig = {
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
        label: "Status report subscribers",
      },
      {
        value: "custom-domain",
        label: "Custom domain",
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
    ],
  },
} as const;
