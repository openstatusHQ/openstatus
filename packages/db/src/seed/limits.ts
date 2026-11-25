import { AVAILABLE_REGIONS } from "@openstatus/regions";

// Retired codes stay so older fixtures keep validating; current ones are added
// so new monitors (whose defaults come from AVAILABLE_REGIONS) can be saved.
const LEGACY_REGIONS = [
  "ams",
  "arn",
  "atl",
  "bog",
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
  "sea",
  "sin",
  "sjc",
  "syd",
  "waw",
  "yul",
  "yyz",
];
const SEED_REGIONS = [...new Set([...LEGACY_REGIONS, ...AVAILABLE_REGIONS])];

// Limits override for the seeded `team` workspace and for team workspaces built
// by the test factories. Looser than the stock team plan (more status pages,
// notification channels and regions) so suites can create fixtures freely
// without tripping a quota check.
//
// Stored as a string because `workspace.limits` is a TEXT column holding JSON.
export const TEAM_WORKSPACE_LIMITS = JSON.stringify({
  monitors: 50,
  "synthetic-checks": 150000,
  periodicity: ["30s", "1m", "5m", "10m", "30m", "1h"],
  "multi-region": true,
  "max-regions": AVAILABLE_REGIONS.length,
  "data-retention": "24 months",
  "status-pages": 20,
  maintenance: true,
  "status-subscribers": true,
  "custom-domain": true,
  "password-protection": true,
  "email-domain-protection": true,
  "white-label": true,
  notifications: true,
  sms: false,
  pagerduty: true,
  "notification-channels": 50,
  members: "Unlimited",
  "audit-log": true,
  regions: SEED_REGIONS,
});
