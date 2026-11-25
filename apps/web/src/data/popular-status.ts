// Pinned on /status: the most visited status pages, services and components
// mixed, ordered by sessions on that exact page (OpenPanel, 90 days to
// 2026-11-06). Edit by hand; an entry that no longer exists is skipped.
export type PopularStatusEntry = { service: string; component?: string };

export const POPULAR_STATUS = [
  { service: "cursor", component: "grok-bot" },
  { service: "anthropic" },
  { service: "openai" },
  { service: "github" },
  { service: "epic-games" },
  { service: "intercom" },
  { service: "cursor" },
  { service: "cloudflare", component: "warp" },
  { service: "npm", component: "security-audit" },
  { service: "anthropic", component: "claude-cowork" },
  { service: "replit" },
  { service: "figma", component: "figma-weave" },
  { service: "discord", component: "brazil" },
  { service: "cursor", component: "cloud-agents" },
  { service: "openai", component: "codex-web" },
  { service: "workos" },
] as const satisfies readonly PopularStatusEntry[];

// Service pages only, for the Markdown index and llms.txt.
export const POPULAR_STATUS_SLUGS: readonly string[] = POPULAR_STATUS.flatMap(
  (e) => ("component" in e ? [] : [e.service]),
);
