export type Plans = "free" | "pro" | "enterprise";

export interface PlanProps {
  title: string;
  description: string;
  cost: number | string;
  features: string[];
  action?:
    | {
        text: string;
        link: string;
      }
    | {
        text: string;
        onClick: () => void;
      };
  disabled?: boolean;
  loading?: boolean;
}

export const plansConfig: Record<Plans, PlanProps> = {
  free: {
    title: "Hobby",
    description: "Get started now and upgrade once reaching the limits.",
    cost: 0,
    features: [
      "5 monitors",
      "1 status page",
      "subdomain",
      "10m, 30m, 1h checks",
    ],
    action: {
      text: "Start Now",
      link: "/app/sign-up?plan=hobby",
    },
  },
  pro: {
    title: "Pro",
    description: "Scale and build monitors for all your services.",
    cost: 29,
    features: [
      "20 monitors",
      "5 status page",
      "custom domain",
      "1m, 5m, 10m, 30m, 1h checks",
      "5 team members",
    ],
    action: {
      text: "Start Now",
      link: "/app/sign-up?plan=pro",
    },
  },
  enterprise: {
    title: "Enterprise",
    description: "Dedicated support and needs for your company.",
    cost: "Lets talk",
    features: [],
    action: {
      text: "Schedule call",
      link: "https://cal.com/team/openstatus/30min",
    },
  },
};
