import type { MonitorPeriodicity } from "@openstatus/db/src/schema";

export const plans = ["free", "starter", "team", "pro"] as const;
export type PlanName = (typeof plans)[number];

export type Plan = {
  title: string;
  description: string;
  price: number;
  limits: {
    // monitors
    monitors: number;
    periodicity: Partial<MonitorPeriodicity>[];
    "multi-region": boolean;
    // status pages
    "status-pages": number;
    "status-subscribers": boolean;
    "custom-domain": boolean;
    // alerts
    notifications: boolean;
    sms: boolean;
    "notification-channels": number;
    // collaboration
    members: number;
  };
};

// TODO: rename to `planConfig`
export const allPlans: Record<PlanName, Plan> = {
  free: {
    title: "Hobby",
    description: "For personal projects",
    price: 0,
    limits: {
      monitors: 5,
      periodicity: ["10m", "30m", "1h"],
      "multi-region": true,
      "status-pages": 1,
      "status-subscribers": false,
      "custom-domain": false,
      notifications: true,
      sms: false,
      "notification-channels": 1,
      members: 1,
    },
  },
  starter: {
    title: "Starter",
    description: "For small projects",
    price: 9,
    limits: {
      monitors: 10,
      periodicity: ["1m", "5m", "10m", "30m", "1h"],
      "multi-region": true,
      "status-pages": 1,
      "status-subscribers": true,
      "custom-domain": true,
      notifications: true,
      sms: false,
      "notification-channels": 3,
      members: 1,
    },
  },
  team: {
    title: "Team",
    description: "For small teams",
    price: 29,
    limits: {
      monitors: 20,
      periodicity: ["1m", "5m", "10m", "30m", "1h"],
      "multi-region": true,
      "status-pages": 5,
      "status-subscribers": true,
      "custom-domain": true,
      notifications: true,
      sms: true,
      "notification-channels": 10,
      members: 5,
    },
  },
  pro: {
    title: "Pro",
    description: "For medium teams",
    price: 99,
    limits: {
      monitors: 100,
      periodicity: ["30s", "1m", "5m", "10m", "30m", "1h"],
      "multi-region": true,
      "status-pages": 10,
      "status-subscribers": true,
      "custom-domain": true,
      notifications: true,
      sms: true,
      "notification-channels": 20,
      members: 20,
    },
  },
};

export { pricingTableConfig } from "./pricing-table";
