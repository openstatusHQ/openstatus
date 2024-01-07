import type { MonitorPeriodicity } from "@openstatus/db/src/schema";

export const plans = ["free", "starter", "team", "pro"] as const;
export type PlanName = (typeof plans)[number];

export type Limits = {
  // monitors
  monitors: number;
  periodicity: Partial<MonitorPeriodicity>[];
  "multi-region": boolean;
  "data-retention": string;
  // status pages
  "status-pages": number;
  "status-subscribers": boolean;
  "custom-domain": boolean;
  "white-label": boolean;
  // alerts
  notifications: boolean;
  sms: boolean;
  "notification-channels": number;
  // collaboration
  members: string;
  "audit-log": boolean;
};

export type FeatureKey = keyof Limits;

export type Plan = {
  title: string;
  description: string;
  price: number;
  limits: Limits;
};

// TODO: rename to `planConfig`
export const allPlans: Record<PlanName, Plan> = {
  free: {
    title: "Hobby",
    description: "For personal projects",
    price: 0,
    limits: {
      monitors: 3,
      periodicity: ["10m", "30m", "1h"],
      "multi-region": true,
      "data-retention": "14 days",
      "status-pages": 1,
      "status-subscribers": false,
      "custom-domain": false,
      "white-label": false,
      notifications: true,
      sms: false,
      "notification-channels": 1,
      members: "1",
      "audit-log": false,
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
      "data-retention": "3 months",
      "status-pages": 1,
      "status-subscribers": true,
      "custom-domain": true,
      "white-label": false,
      notifications: true,
      sms: false,
      "notification-channels": 3,
      members: "Unlimited",
      "audit-log": false,
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
      "data-retention": "12 months",
      "status-pages": 5,
      "status-subscribers": true,
      "custom-domain": true,
      "white-label": false,
      notifications: true,
      sms: true,
      "notification-channels": 10,
      members: "Unlimited",
      "audit-log": true,
    },
  },
  pro: {
    title: "Pro",
    description: "For bigger teams",
    price: 99,
    limits: {
      monitors: 100,
      periodicity: ["30s", "1m", "5m", "10m", "30m", "1h"],
      "multi-region": true,
      "data-retention": "24 months",
      "status-pages": 10,
      "status-subscribers": true,
      "custom-domain": true,
      "white-label": true,
      notifications: true,
      sms: true,
      "notification-channels": 20,
      members: "Unlimited",
      "audit-log": true,
    },
  },
};

export { pricingTableConfig } from "./pricing-table";
