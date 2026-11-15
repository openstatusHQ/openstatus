import {
  Agent,
  Chat,
  Globe,
  type IconType,
  Incident,
  Maintenance,
  Monitor,
  Notification,
  Overview,
  Reporting,
  Settings,
  StatusPage,
  Terminal,
  Trend,
} from "@openstatus/icons";
import { ModelContextProtocolIcon } from "@openstatus/icons/brand";

export type NavItem = {
  label: string;
  href: string;
  icon: IconType;
  keywords?: string[];
  badge?: string;
  /** Shown but not navigable, e.g. a section that has not shipped yet. */
  disabled?: boolean;
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
  slas: {
    label: "SLAs",
    href: "/reportings",
    icon: Reporting,
    keywords: [
      "sla",
      "policy",
      "uptime target",
      "availability",
      "commitment",
      "reporting",
      "report",
    ],
  },
  insights: {
    label: "Insights",
    href: "/insights",
    icon: Trend,
    keywords: ["mttr", "mtta", "analytics"],
    badge: "Soon",
    disabled: true,
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
    keywords: ["slack", "cli", "mcp"],
  },
  cli: {
    label: "CLI",
    href: "/agents/cli",
    icon: Terminal,
    keywords: ["terminal"],
  },
  mcp: {
    label: "MCP",
    href: "/agents/mcp",
    icon: ModelContextProtocolIcon,
    keywords: ["model context protocol", "claude", "cursor"],
  },
  settings: {
    label: "Settings",
    href: "/settings/general",
    icon: Settings,
    keywords: ["workspace"],
  },
} satisfies Record<string, NavItem>;

// Sidebar groups, in order. Overview sits above them, Settings below.
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Monitor",
    items: [
      NAV.monitors,
      NAV.maintenanceWindows,
      NAV.notifications,
      NAV.privateLocations,
    ],
  },
  { label: "Communicate", items: [NAV.incidents, NAV.statusPages] },
  { label: "Report", items: [NAV.slas, NAV.insights] },
  { label: "AI", items: [NAV.chat, NAV.agents] },
];

// Command-menu "Navigation" group order; disabled items are left out.
export const NAV_MENU_ITEMS: NavItem[] = [
  NAV.overview,
  NAV.monitors,
  NAV.maintenanceWindows,
  NAV.notifications,
  NAV.privateLocations,
  NAV.statusPages,
  NAV.slas,
  NAV.chat,
  NAV.agents,
  NAV.cli,
  NAV.mcp,
];
