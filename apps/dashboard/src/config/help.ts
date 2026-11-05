import { Api, Copy, Docs, Schedule, Support } from "@openstatus/icons";
import {
  DiscordIcon,
  GitHubIcon,
  ModelContextProtocolIcon,
} from "@openstatus/icons/brand";
import type * as React from "react";

// Nucleo/lucide icons and the custom brand icons both accept svg props.
export type HelpIcon = React.ComponentType<React.ComponentProps<"svg">>;

// Single source of truth for the Get Help menu (sidebar nav-help) and the
// command-menu "Get Help" group so their icons stay in sync.
export const HELP_SUPPORT = {
  label: "Support",
  icon: Support as HelpIcon,
  keywords: ["feedback", "help", "contact"],
};

// Copies the "ask" prompt from config/agent-prompts.
export const HELP_ASK_AGENT = {
  label: "Ask your agent",
  icon: Copy as HelpIcon,
  keywords: ["ai", "prompt", "llm", "claude", "chatgpt", "cursor", "question"],
};

// Sidebar menu only; the command menu already lists Agents, CLI and MCP.
export const HELP_CONNECT_AGENT = {
  label: "Connect your agent",
  href: "/agents/mcp",
  icon: ModelContextProtocolIcon as HelpIcon,
};

export type HelpLink = {
  label: string;
  href: string;
  icon: HelpIcon;
  keywords?: string[];
};

export const HELP_LINKS = [
  {
    label: "Docs",
    href: "https://www.openstatus.dev/docs",
    icon: Docs,
    keywords: ["documentation"],
  },
  {
    label: "API Reference",
    href: "https://api.openstatus.dev/openapi",
    icon: Api,
    keywords: ["openapi", "swagger"],
  },
  {
    label: "Book a Call",
    href: "https://openstatus.dev/cal",
    icon: Schedule,
    keywords: ["demo", "meeting"],
  },
  {
    label: "Community",
    href: "https://openstatus.dev/discord",
    icon: DiscordIcon,
    keywords: ["discord", "chat"],
  },
  {
    label: "GitHub",
    href: "https://openstatus.dev/github",
    icon: GitHubIcon,
    keywords: ["source", "repo", "issues"],
  },
] satisfies HelpLink[];
