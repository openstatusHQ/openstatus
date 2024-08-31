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
        catchline: "Cron Monitoring.",
        badge: "Coming soon",
        description:
          "Never let a cron job fail you. Get notified when a job did not run successfully.",
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
        icon: "sparkles",
        catchline: "Reduce fatigue.",
        description:
          "Reduce your alerts fatigue with automatic noise reduction.",
        badge: "Coming soon",
      },
      {
        icon: "zap",
        catchline: "Escalation.",
        description: "Notify and escalate an alert to the right team member.",
        badge: "Coming soon",
      },
      {
        icon: "bell",
        catchline: "Get alerted.",
        description:
          "Get notified via Email, SMS, Slack, Discord,... before your users do.",
      },
    ],
  },
} satisfies Record<string, Feature>;
