import { AVAILABLE_REGIONS, FREE_FLY_REGIONS } from "@openstatus/regions";
import type { WorkspacePlan } from "../workspaces/validation";
import type { Addons, PlanLimits, Price } from "./schema";

type PlanConfig = {
  title: "Hobby" | "Starter" | "Pro";
  id: WorkspacePlan;
  description: string;
  price: Price;
  addons: Partial<Addons>;
  limits: PlanLimits;
};

// TODO: rename to `planConfig`
export const allPlans: Record<WorkspacePlan, PlanConfig> = {
  free: {
    title: "Hobby",
    id: "free",
    description: "Perfect for personal projects",
    price: {
      USD: 0,
      EUR: 0,
      INR: 0,
    },
    addons: {},
    limits: {
      version: undefined,
      monitors: 1,
      "synthetic-checks": 30,
      periodicity: ["10m", "30m", "1h"],
      "multi-region": true,
      "max-regions": 6,
      "data-retention": "14 days",
      "status-pages": 1,
      maintenance: true,
      "monitor-values-visibility": true,
      "response-logs": false,
      screenshots: false,
      otel: false,
      "status-subscribers": false,
      "custom-domain": false,
      "password-protection": false,
      "email-domain-protection": false,
      "white-label": false,
      notifications: true,
      sms: false,
      "sms-limit": 0,
      pagerduty: false,
      opsgenie: false,
      whatsapp: false,
      "notification-channels": 1,
      members: 1,
      "audit-log": false,
      regions: [...FREE_FLY_REGIONS],
      "private-locations": false,
    },
  },
  starter: {
    title: "Starter",
    id: "starter",
    description: "Perfect for uptime monitoring",
    price: {
      USD: 30,
      EUR: 30,
      INR: 3000,
    },
    addons: {
      "email-domain-protection": {
        price: {
          USD: 100,
          EUR: 100,
          INR: 10_000,
        },
      },
    },
    limits: {
      version: undefined,
      monitors: 20,
      "synthetic-checks": 100,
      periodicity: ["1m", "5m", "10m", "30m", "1h"],
      "multi-region": true,
      "max-regions": 6,
      "data-retention": "3 months",
      "status-pages": 1,
      maintenance: true,
      "monitor-values-visibility": true,
      "response-logs": true,
      screenshots: true,
      otel: false,
      "status-subscribers": true,
      "custom-domain": true,
      "password-protection": true,
      "email-domain-protection": false,
      "white-label": false,
      notifications: true,
      pagerduty: true,
      opsgenie: true,
      whatsapp: true,
      sms: true,
      "sms-limit": 50,
      "notification-channels": 10,
      members: "Unlimited",
      "audit-log": false,
      regions: [...AVAILABLE_REGIONS],
      "private-locations": false,
    },
  },
  team: {
    title: "Pro",
    id: "team",
    description: "Perfect for global synthetic monitoring",
    price: {
      USD: 100,
      EUR: 100,
      INR: 10_000,
    },
    addons: {
      "email-domain-protection": {
        price: {
          USD: 100,
          EUR: 100,
          INR: 10_000,
        },
      },
    },
    limits: {
      version: undefined,
      monitors: 50,
      "synthetic-checks": 300,
      periodicity: ["30s", "1m", "5m", "10m", "30m", "1h"],
      "multi-region": true,
      "max-regions": AVAILABLE_REGIONS.length,
      "data-retention": "12 months",
      "status-pages": 5,
      maintenance: true,
      "monitor-values-visibility": true,
      "response-logs": true,
      screenshots: true,
      otel: true,
      "status-subscribers": true,
      "custom-domain": true,
      "password-protection": true,
      "email-domain-protection": false,
      "white-label": false,
      notifications: true,
      sms: true,
      "sms-limit": 100,
      pagerduty: true,
      opsgenie: true,
      whatsapp: true,
      "notification-channels": 20,
      members: "Unlimited",
      "audit-log": true,
      regions: [...AVAILABLE_REGIONS],
      "private-locations": true,
    },
  },
};
