import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Bot,
  Cog,
  LayoutGrid,
  MessageSquare,
  PanelTop,
  Terminal,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  keywords?: string[];
};

// Single source of truth for primary destinations. Consumed by the sidebar
// (icon + href) and the command menu (icon + href + label + keywords), so an
// icon swap here propagates to both surfaces.
export const NAV = {
  overview: {
    label: "Overview",
    href: "/overview",
    icon: LayoutGrid,
    keywords: ["home", "dashboard"],
  },
  monitors: {
    label: "Monitors",
    href: "/monitors",
    icon: Activity,
    keywords: ["checks", "uptime"],
  },
  statusPages: {
    label: "Status Pages",
    href: "/status-pages",
    icon: PanelTop,
    keywords: ["pages"],
  },
  notifications: {
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
    keywords: ["notifiers", "alerts", "channels"],
  },
  chat: {
    label: "Chat",
    href: "/chat",
    icon: MessageSquare,
    keywords: ["assistant", "ai"],
  },
  agents: {
    label: "Agents",
    href: "/agents",
    icon: Bot,
    keywords: ["slack"],
  },
  cli: {
    label: "CLI",
    href: "/cli",
    icon: Terminal,
    keywords: ["terminal"],
  },
  settings: {
    label: "Settings",
    href: "/settings/general",
    icon: Cog,
    keywords: ["workspace"],
  },
} satisfies Record<string, NavItem>;

// Command-menu "Navigation" group order.
export const NAV_MENU_ITEMS: NavItem[] = [
  NAV.overview,
  NAV.monitors,
  NAV.statusPages,
  NAV.notifications,
  NAV.chat,
  NAV.agents,
  NAV.cli,
];
