import type { WorkspacePlan } from "@openstatus/db/src/schema";

import type { Limits } from "./types";

// TODO: rename to `planConfig`
export const allPlans: Record<
  WorkspacePlan,
  {
    title: "Hobby" | "Starter" | "Growth" | "Pro";
    description: string;
    price: number;
    limits: Limits;
  }
> = {
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
      maintenance: true,
      "status-subscribers": false,
      "custom-domain": false,
      "password-protection": false,
      "white-label": false,
      notifications: true,
      sms: false,
      "notification-channels": 1,
      members: 1,
      "audit-log": false,
      regions: ["ams", "gru", "iad", "jnb", "hkg", "syd"],
    },
  },
  starter: {
    title: "Starter",
    description: "For small projects",
    price: 29,
    limits: {
      monitors: 30,
      periodicity: ["1m", "5m", "10m", "30m", "1h"],
      "multi-region": true,
      "data-retention": "3 months",
      "status-pages": 1,
      maintenance: true,
      "status-subscribers": true,
      "custom-domain": true,
      "password-protection": true,
      "white-label": false,
      notifications: true,
      sms: true,
      "notification-channels": 10,
      members: "Unlimited",
      "audit-log": false,
      regions: [
        "ams",
        "arn",
        "atl",
        "bog",
        "bom",
        "bos",
        "cdg",
        "den",
        "dfw",
        "ewr",
        "eze",
        "fra",
        "gdl",
        "gig",
        "gru",
        "hkg",
        "iad",
        "jnb",
        "lax",
        "lhr",
        "mad",
        "mia",
        "nrt",
        "ord",
        "otp",
        "phx",
        "qro",
        "scl",
        "syd",
        "waw",
        "yul",
        "yyz",
      ],
    },
  },
  team: {
    title: "Growth",
    description: "For small teams",
    price: 79,
    limits: {
      monitors: 100,
      periodicity: ["30s", "1m", "5m", "10m", "30m", "1h"],
      "multi-region": true,
      "data-retention": "12 months",
      "status-pages": 5,
      maintenance: true,
      "status-subscribers": true,
      "custom-domain": true,
      "password-protection": true,
      "white-label": false,
      notifications: true,
      sms: true,
      "notification-channels": 20,
      members: "Unlimited",
      "audit-log": true,
      regions: [
        "ams",
        "arn",
        "atl",
        "bog",
        "bom",
        "bos",
        "cdg",
        "den",
        "dfw",
        "ewr",
        "eze",
        "fra",
        "gdl",
        "gig",
        "gru",
        "hkg",
        "iad",
        "jnb",
        "lax",
        "lhr",
        "mad",
        "mia",
        "nrt",
        "ord",
        "otp",
        "phx",
        "qro",
        "scl",
        "syd",
        "waw",
        "yul",
        "yyz",
      ],
    },
  },
  pro: {
    title: "Pro",
    description: "For bigger teams",
    price: 149,
    limits: {
      monitors: 500,
      periodicity: ["30s", "1m", "5m", "10m", "30m", "1h"],
      "multi-region": true,
      "data-retention": "24 months",
      "status-pages": 20,
      maintenance: true,
      "status-subscribers": true,
      "custom-domain": true,
      "password-protection": true,
      "white-label": true,
      notifications: true,
      sms: true,
      "notification-channels": 50,
      members: "Unlimited",
      "audit-log": true,
      regions: [
        "ams",
        "arn",
        "atl",
        "bog",
        "bom",
        "bos",
        "cdg",
        "den",
        "dfw",
        "ewr",
        "eze",
        "fra",
        "gdl",
        "gig",
        "gru",
        "hkg",
        "iad",
        "jnb",
        "lax",
        "lhr",
        "mad",
        "mia",
        "nrt",
        "ord",
        "otp",
        "phx",
        "qro",
        "scl",
        "syd",
        "waw",
        "yul",
        "yyz",
      ],
    },
  },
};
