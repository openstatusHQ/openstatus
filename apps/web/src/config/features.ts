import type { ValidIcon } from "@/components/icons";

export type Feature = {
  icon: ValidIcon;
  title: string;
  // description?: string;
  features?: {
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
        catchline: "Custom Headers.",
        description:
          "Add your own headers to the request and access secured endpoints.",
      },
      {
        catchline: "Run on demand.",
        description: "Check if your endpoint is up and running with one click.",
      },
      {
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
        catchline: "Custom slug.",
        description:
          "Great your own sudomain and inform your users about the uptime of your endpoints.",
      },
      {
        catchline: "Custom domain.",
        description:
          "Give the status page a personal touch. Including the favicon.",
      },
      {
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
        catchline: "Alerts.",
        description: "Be informed if your endpoint fails.",
        badge: "Coming soon",
      },
      {
        catchline: "Inform.",
        description: "Keep your users updated with incident updates.",
      },
    ],
  },
} satisfies Record<string, Feature>;
