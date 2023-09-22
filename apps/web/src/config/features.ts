import type { ValidIcon } from "@/components/icons";

export type Feature = {
  icon: ValidIcon;
  title: string;
  // description?: string;
  features?: {
    icon: ValidIcon;
    catchline: string;
    description: string;
    badge?: "Coming soon" | "New";
  }[];
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
    title: "Monitors",
    features: [
      {
        icon: "cog",
        catchline: "Custom Headers.",
        description:
          "Add your own headers to the request and access secured endpoints.",
      },
      {
        icon: "play",
        catchline: "Run on demand.",
        description: "Check if your endpoint is up and running with one click.",
      },
      {
        icon: "bot",
        catchline: "Automatic checks.",
        description:
          "Define the region where to call the request and the frequency how often to call it.",
      },
    ],
  },
  pages: {
    icon: "panel-top",
    title: "Status Pages",
    features: [
      {
        icon: "puzzle",
        catchline: "Custom slug.",
        description:
          "Great your own sudomain and inform your users about the uptime of your endpoints.",
      },
      {
        icon: "globe",
        catchline: "Custom domain.",
        description:
          "Give the status page a personal touch. Including the favicon.",
      },
      {
        icon: "image",
        catchline: "OG images.",
        description:
          "Get a custom image with the current uptime of your first monitor.",
      },
    ],
  },
  incidents: {
    icon: "siren",
    title: "Incidents",
    features: [
      {
        icon: "bell",
        catchline: "Alerts.",
        description: "Be informed if your endpoint fails.",
        badge: "Coming soon",
      },
      {
        icon: "message-circle",
        catchline: "Inform.",
        description: "Keep your users updated with incident updates.",
      },
      {
        icon: "zap",
        catchline: "Blazingly Fast.",
        description: "Respond to incident faster than ever.",
      },
    ],
  },
} satisfies Record<string, Feature>;
