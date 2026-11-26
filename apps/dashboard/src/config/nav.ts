import {
  Agent,
  ApiKey,
  BookOpen,
  Chat,
  Code,
  Globe,
  type IconType,
  Incident,
  Maintenance,
  Monitor,
  Notification,
  Overview,
  Schedule,
  Settings,
  StatusPage,
  Terminal,
} from "@openstatus/icons";
import { ModelContextProtocolIcon, SlackIcon } from "@openstatus/icons/brand";

export type NavItem = {
  label: string;
  href: string;
  icon: IconType;
  keywords?: string[];
  badge?: string;
};

// Single source of truth for primary destinations. Consumed by the sidebar
// (icon + href) and the command menu (icon + href + label + keywords), so an
// icon swap here propagates to both surfaces.
export const NAV = {
  overview: {
    label: "Overview",
    href: "/overview",
    icon: Overview,
    keywords: ["home", "dashboard"],
  },
  incidents: {
    label: "Incidents",
    href: "/incidents",
    icon: Incident,
    keywords: ["declare", "outage", "postmortem", "commander"],
    badge: "New",
  },
  monitors: {
    label: "Monitors",
    href: "/monitors",
    icon: Monitor,
    keywords: ["checks", "uptime"],
  },
  maintenanceWindows: {
    label: "Maintenance Windows",
    href: "/maintenance-windows",
    icon: Maintenance,
    keywords: ["maintenance", "window", "pause", "downtime"],
  },
  privateLocations: {
    label: "Private Locations",
    href: "/private-locations",
    icon: Globe,
    keywords: ["probes", "regions", "self-hosted"],
  },
  onCall: {
    label: "On-call",
    href: "/on-call",
    icon: Schedule,
    keywords: ["rotation", "schedule", "escalation", "pager"],
    badge: "Soon",
  },
  statusPages: {
    label: "Status Pages",
    href: "/status-pages",
    icon: StatusPage,
    keywords: ["pages"],
  },
  notifications: {
    label: "Notifications",
    href: "/notifications",
    icon: Notification,
    keywords: ["notifiers", "alerts", "channels"],
  },
  chat: {
    label: "Assistant",
    href: "/chat",
    icon: Chat,
    keywords: ["chat", "ai"],
  },
  agents: {
    label: "Agents",
    href: "/agents/slack",
    icon: Agent,
    keywords: ["slack", "mcp", "ai"],
  },
  slackAgent: {
    label: "Slack Agent",
    href: "/agents/slack",
    icon: SlackIcon,
    keywords: ["slack", "integration", "install", "bot"],
  },
  mcp: {
    label: "MCP",
    href: "/agents/mcp",
    icon: ModelContextProtocolIcon,
    keywords: ["model context protocol", "claude", "cursor"],
  },
  playbooks: {
    label: "Playbooks",
    href: "/agents/playbooks",
    icon: BookOpen,
    keywords: ["runbook", "process", "style guide", "postmortem template"],
  },
  developers: {
    label: "Developers",
    href: "/developers/api-keys",
    icon: Code,
    keywords: ["api", "cli", "terraform", "sdk"],
  },
  apiKeys: {
    label: "API Keys",
    href: "/developers/api-keys",
    icon: ApiKey,
    keywords: ["api key", "token", "key", "terraform", "settings"],
  },
  cli: {
    label: "CLI",
    href: "/developers/cli",
    icon: Terminal,
    keywords: ["terminal", "command line", "github action"],
  },
  settings: {
    label: "Settings",
    href: "/settings/general",
    icon: Settings,
    keywords: ["workspace"],
  },
} satisfies Record<string, NavItem>;

// Sidebar groups, in order. Overview and Assistant sit above them, Settings
// below. A group without a label renders its items standalone.
export const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    label: "Monitor",
    items: [NAV.monitors, NAV.maintenanceWindows, NAV.privateLocations],
  },
  { label: "Respond", items: [NAV.incidents, NAV.notifications, NAV.onCall] },
  { label: "Communicate", items: [NAV.statusPages] },
  { label: "Build", items: [NAV.agents, NAV.developers] },
];

// Command-menu "Navigation" group, in sidebar order plus the tabs worth a jump.
export const NAV_MENU_ITEMS: NavItem[] = [
  NAV.overview,
  NAV.chat,
  ...NAV_GROUPS.flatMap((group) => group.items).flatMap((item) =>
    item === NAV.agents
      ? [item, NAV.slackAgent, NAV.mcp, NAV.playbooks]
      : item === NAV.developers
        ? [item, NAV.apiKeys, NAV.cli]
        : [item],
  ),
];
