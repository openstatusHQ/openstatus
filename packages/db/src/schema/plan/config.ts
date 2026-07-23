import { AVAILABLE_REGIONS, FREE_FLY_REGIONS } from "@openstatus/regions";

import type { WorkspacePlan } from "../workspaces/validation";
import type { Addons, IntervalPrice, PlanLimits, Price } from "./schema";

type PlanConfig = {
  title: "Hobby" | "Starter" | "Pro" | "Scale";
  id: WorkspacePlan;
  description: string;
  price: IntervalPrice;
  addons: Partial<{
    [K in keyof Addons]: {
      title: string;
      description: string;
      price: Price;
    };
  }>;
  limits: PlanLimits;
};

// TODO: rename to `planConfig`
export const allPlans: Record<WorkspacePlan, PlanConfig> = {
  free: {
    title: "Hobby",
    id: "free",
    description: "Perfect for personal projects",
    price: {
      monthly: { USD: 0, EUR: 0 },
      yearly: { USD: 0, EUR: 0 },
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
      "page-components": 3,
      maintenance: true,
      "monitor-values-visibility": true,
      "uptime-history": false,
      "response-logs": false,
      screenshots: false,
      otel: false,
      "status-subscribers": false,
      "custom-domain": false,
      i18n: false,
      "password-protection": false,
      "email-domain-protection": false,
      "ip-restriction": false,
      "white-label": false,
      "no-index": false,
      "custom-theme": false,
      notifications: true,
      sms: false,
      "sms-limit": 0,
      pagerduty: false,
      opsgenie: false,
      "grafana-oncall": false,
      whatsapp: false,
      "notification-channels": 1,
      members: 1,
      "audit-log": false,
      regions: [...FREE_FLY_REGIONS],
      "private-locations": false,
      "slack-agent": false,
    },
  },
  starter: {
    title: "Starter",
    id: "starter",
    description: "Perfect for uptime monitoring",
    price: {
      monthly: { USD: 30, EUR: 30 },
      yearly: { USD: 300, EUR: 300 },
    },
    addons: {
      "email-domain-protection": {
        title: "Magic Link (Auth)",
        description:
          "Only allow user with a given email domain to access the status page.",
        price: {
          USD: 100,
          EUR: 100,
        },
      },
      "ip-restriction": {
        title: "IP Restriction",
        description:
          "Restrict status page access to specific IPv4 CIDR ranges.",
        price: {
          USD: 100,
          EUR: 100,
        },
      },
      "white-label": {
        title: "White Label",
        description:
          "Remove the 'powered by openstatus.dev' footer from your status pages.",
        price: {
          USD: 300,
          EUR: 300,
        },
      },
      "custom-theme": {
        title: "Custom Theme",
        description: "Customize your status page colors and appearance.",
        price: {
          USD: 20,
          EUR: 20,
        },
      },
      "status-pages": {
        title: "Status Pages",
        description: "Create and manage status pages for your workspace.",
        price: {
          USD: 20,
          EUR: 20,
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
      "page-components": 20,
      maintenance: true,
      "monitor-values-visibility": true,
      "uptime-history": false,
      "response-logs": true,
      screenshots: true,
      otel: false,
      "status-subscribers": true,
      "custom-domain": true,
      i18n: true,
      "password-protection": true,
      "email-domain-protection": false,
      "ip-restriction": false,
      "white-label": false,
      "no-index": true,
      "custom-theme": false,
      notifications: true,
      pagerduty: true,
      opsgenie: true,
      "grafana-oncall": true,
      whatsapp: true,
      sms: true,
      "sms-limit": 50,
      "notification-channels": 10,
      members: "Unlimited",
      "audit-log": false,
      regions: [...AVAILABLE_REGIONS],
      "private-locations": false,
      "slack-agent": true,
    },
  },
  team: {
    title: "Pro",
    id: "team",
    description: "Perfect for global synthetic monitoring",
    price: {
      monthly: { USD: 100, EUR: 100 },
      yearly: { USD: 1_000, EUR: 1_000 },
    },
    addons: {
      "email-domain-protection": {
        title: "Magic Link (Auth)",
        description:
          "Only allow user with a given email domain to access the status page.",
        price: {
          USD: 100,
          EUR: 100,
        },
      },
      "ip-restriction": {
        title: "IP Restriction",
        description:
          "Restrict status page access to specific IPv4 CIDR ranges.",
        price: {
          USD: 100,
          EUR: 100,
        },
      },
      "white-label": {
        title: "White Label",
        description:
          "Remove the 'powered by openstatus.dev' footer from your status pages.",
        price: {
          USD: 300,
          EUR: 300,
        },
      },
      "status-pages": {
        title: "Status Pages",
        description: "Create and manage status pages for your workspace.",
        price: {
          USD: 20,
          EUR: 20,
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
      "page-components": 50,
      maintenance: true,
      "monitor-values-visibility": true,
      "uptime-history": true,
      "response-logs": true,
      screenshots: true,
      otel: true,
      "status-subscribers": true,
      "custom-domain": true,
      i18n: true,
      "password-protection": true,
      "email-domain-protection": false,
      "ip-restriction": false,
      "white-label": false,
      "no-index": true,
      "custom-theme": true,
      notifications: true,
      sms: true,
      "sms-limit": 100,
      pagerduty: true,
      opsgenie: true,
      "grafana-oncall": true,
      whatsapp: true,
      "notification-channels": 20,
      members: "Unlimited",
      "audit-log": true,
      regions: [...AVAILABLE_REGIONS],
      "private-locations": true,
      "slack-agent": true,
    },
  },
  scale: {
    title: "Scale",
    id: "scale",
    description: "For teams running serious infrastructure at scale",
    price: {
      monthly: { USD: 500, EUR: 500 },
      yearly: { USD: 5_000, EUR: 5_000 },
    },
    addons: {
      "status-pages": {
        title: "Status Pages",
        description: "Create and manage status pages for your workspace.",
        price: {
          USD: 20,
          EUR: 20,
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
      "data-retention": "24 months",
      "status-pages": 10,
      "page-components": 500,
      maintenance: true,
      "monitor-values-visibility": true,
      "uptime-history": true,
      "response-logs": true,
      screenshots: true,
      otel: true,
      "status-subscribers": true,
      "custom-domain": true,
      i18n: true,
      "password-protection": true,
      "email-domain-protection": true,
      "ip-restriction": true,
      "white-label": true,
      "no-index": true,
      "custom-theme": true,
      notifications: true,
      sms: true,
      "sms-limit": 100,
      pagerduty: true,
      opsgenie: true,
      "grafana-oncall": true,
      whatsapp: true,
      "notification-channels": 20,
      members: "Unlimited",
      "audit-log": true,
      regions: [...AVAILABLE_REGIONS],
      "private-locations": true,
      "slack-agent": true,
    },
  },
};
