// Pinned on /status from OpenPanel sessions (90 days to 2026-11-06). Edit by
// hand; a slug that no longer exists is skipped.

// Services, ordered by sessions on the service page plus its component pages.
export const POPULAR_STATUS_SLUGS = [
  "cursor",
  "anthropic",
  "openai",
  "epic-games",
  "github",
  "cloudflare",
  "intercom",
  "npm",
  "figma",
  "replit",
  "discord",
  "workos",
  "shopify",
  "amplitude",
  "greenhouse",
  "sentry",
] as const;

// Component pages people open directly, ordered by their own sessions.
export const POPULAR_STATUS_COMPONENTS = [
  { service: "cursor", component: "grok-bot" },
  { service: "cloudflare", component: "warp" },
  { service: "npm", component: "security-audit" },
  { service: "anthropic", component: "claude-cowork" },
  { service: "figma", component: "figma-weave" },
  { service: "discord", component: "brazil" },
  { service: "cursor", component: "cloud-agents" },
  { service: "openai", component: "codex-web" },
] as const;
