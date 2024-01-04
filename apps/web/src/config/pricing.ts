type Plan = "hobby" | "starter" | "team" | "pro";

export const plansConfig: Record<
  Plan,
  { title: string; description: string; price: number }
> = {
  hobby: {
    title: "Hobby",
    description: "For personal projects",
    price: 0,
  },
  starter: {
    title: "Starter",
    description: "For small projects",
    price: 9,
  },
  team: {
    title: "Team",
    description: "For small teams",
    price: 29,
  },
  pro: {
    title: "Pro",
    description: "For medium teams",
    price: 99,
  },
};

export const pricingTableConfig: Record<
  string,
  {
    title: string;
    features: {
      title: string;
      values: Record<Plan, string | number | boolean>;
    }[];
  }
> = {
  monitors: {
    title: "Monitors",
    features: [
      {
        title: "Frequency",
        values: {
          hobby: "10 minutes",
          starter: "1 minute",
          team: "1 minute",
          pro: "30 seconds",
        },
      },
      {
        title: "Number of monitors",
        values: {
          hobby: 5,
          starter: 10,
          team: 20,
          pro: 100,
        },
      },
    ],
  },
  "status-pages": {
    title: "Status Pages",
    features: [
      {
        title: "Number of status pages",
        values: {
          hobby: 1,
          starter: 1,
          team: 5,
          pro: 10,
        },
      },
      {
        title: "Status report subscribers",
        values: {
          hobby: false,
          starter: true,
          team: true,
          pro: true,
        },
      },
      {
        title: "Custom domain",
        values: {
          hobby: false,
          starter: true,
          team: true,
          pro: true,
        },
      },
    ],
  },
  alerts: {
    title: "Alerts",
    features: [
      {
        title: "Slack, Discord, Email",
        values: {
          hobby: true,
          starter: true,
          team: true,
          pro: true,
        },
      },
      {
        title: "SMS",
        values: {
          hobby: false,
          starter: false,
          team: true,
          pro: true,
        },
      },
      {
        title: "Number of notification channels",
        values: {
          hobby: 1,
          starter: 3,
          team: 10,
          pro: 20,
        },
      },
    ],
  },
  collaboration: {
    title: "Collaboration",
    features: [
      {
        title: "Team members",
        values: {
          hobby: 1,
          starter: 1,
          team: 5,
          pro: 20,
        },
      },
    ],
  },
};
