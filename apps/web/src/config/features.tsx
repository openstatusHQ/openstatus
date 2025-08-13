import type { ValidIcon } from "@/components/icons";

export type Feature = {
  icon: ValidIcon;
  title: string;
  // description?: string;
  features?: FeatureDescription[];
};

export type FeatureDescription = {
  icon: ValidIcon;
  catchline: string;
  description: React.ReactNode;
  badge?: "Coming soon" | "New";
};

export type SpecialFeature = {
  icon: ValidIcon;
  title: string;
  catchline: string;
  description: string;
};

export const specialCardConfig = {
  icon: "toy-brick",
  title: "Integrations",
  catchline: "Connect.",
  description: "Build or use existing integrations to automate your workflow.",
} satisfies SpecialFeature;

export const cardConfig = {
  monitors: {
    icon: "activity",
    title: "Monitoring",
    features: [
      {
        icon: "globe",
        catchline: "Latency Monitoring.",
        description:
          "Monitor the latency of your endpoints from all over the world. We support all the continents.",
      },
      {
        icon: "play",
        catchline: "Monitor anything.",
        description:
          "API, DNS, domain, SSL, SMTP, ping, webpage... We can monitor it all.",
      },
      {
        icon: "bot",
        catchline: "OpenTelemetry.",
        description:
          "Export your synthetic monitoring metrics to your observability stack.",
      },
    ],
  },
  pages: {
    icon: "panel-top",
    title: "Status Pages",
    features: [
      {
        icon: "puzzle",
        catchline: "Build trust",
        description:
          "Showcase your reliability to your users, and reduce the number of customer service tickets.",
      },
      {
        icon: "globe",
        catchline: "Custom domain.",
        description:
          "Bring your own domain, give the status page a personal touch.",
      },
      {
        icon: "image",
        catchline: "Subscription",
        description:
          "Let your users subscribe to your status page, to automatically receive updates about the status of your services.",
      },
    ],
  },
  alerts: {
    icon: "siren",
    title: "Alerting",
    features: [
      {
        icon: "bell",
        catchline: "Get alerted.",
        description:
          "Receive notifications via Email, SMS, Slack, or Discord, ... so you're always aware before your users are.",
      },
      {
        icon: "eye",
        catchline: "Know the activity.",
        description:
          "Gain complete visibility: All recoveries, incidents and notifications, together in one timeline.",
      },
      {
        icon: "zap",
        catchline: "Escalation.",
        description: "Notify and escalate an alert to the right team member.",
        badge: "Coming soon",
      },
    ],
  },
  cli: {
    icon: "terminal",
    title: "CLI",
    features: [
      {
        icon: "file-text",
        catchline: "YAML file configuration",
        description: "Use version control to keep track of all your changes.",
      },
      {
        icon: "sparkles",
        catchline: "Monitoring as Code",
        description:
          "Apply changes to your monitors directly from the terminal.",
      },
      {
        icon: "workflow",
        catchline: "CI/CD",
        description:
          "Trigger a specific monitor or run your file within your workflows.",
      },
    ],
  },
} satisfies Record<string, Feature>;
