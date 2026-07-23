import { AtSign, KeyRound, Palette, Pencil, Plus, Users } from "lucide-react";
import type * as React from "react";

import { MONITOR_TABS } from "@/app/(dashboard)/monitors/[id]/constants";
import { STATUS_PAGE_TABS } from "@/app/(dashboard)/status-pages/[id]/constants";
import { HELP_LINKS, HELP_SUPPORT } from "@/config/help";
import { NAV_MENU_ITEMS } from "@/config/nav";
import { SETTINGS_TABS } from "@/config/settings";

// Lucide icons and the custom brand icons both accept svg props.
export type CommandIcon = React.ComponentType<React.ComponentProps<"svg">>;

export type CommandLink = {
  label: string;
  href: string;
  icon: CommandIcon;
  keywords?: string[];
  external?: boolean;
};

export type CommandSheetAction = {
  label: string;
  icon: CommandIcon;
  keywords?: string[];
  sheet: "status-report" | "maintenance" | "support";
};

export type CommandPage =
  | { type: "monitor"; id: number; name: string }
  | { type: "status-page"; id: number; title: string };

export const NAVIGATION: CommandLink[] = NAV_MENU_ITEMS.map((item) => ({
  label: item.label,
  href: item.href,
  icon: item.icon,
  keywords: item.keywords,
}));

export const CREATE_LINKS: CommandLink[] = [
  {
    label: "Create Monitor",
    href: "/monitors/create",
    icon: Plus,
    keywords: ["new monitor"],
  },
  {
    label: "Create Status Page",
    href: "/status-pages/create",
    icon: Plus,
    keywords: ["new page"],
  },
];

export const CREATE_ACTIONS: CommandSheetAction[] = [
  {
    label: "Create Status Report",
    icon: Plus,
    keywords: ["incident", "announce", "publish"],
    sheet: "status-report",
  },
  {
    label: "Create Maintenance",
    icon: Plus,
    keywords: ["downtime", "window", "schedule"],
    sheet: "maintenance",
  },
];

const SETTINGS_TAB_LINKS: CommandLink[] = SETTINGS_TABS.map((tab) => ({
  label: tab.label,
  href: tab.href,
  icon: tab.icon,
  keywords: tab.keywords,
}));

// Deep-links into settings cards via anchor ids. Icons are only used here, so
// they live with the command menu rather than a shared config.
const SETTINGS_ANCHORS: CommandLink[] = [
  {
    label: "API Keys",
    href: "/settings/general#api-keys",
    icon: KeyRound,
    keywords: ["token", "key"],
  },
  {
    label: "Team Members",
    href: "/settings/general#team-members",
    icon: Users,
    keywords: ["invite", "member"],
  },
  {
    label: "Workspace Slug",
    href: "/settings/general#workspace-slug",
    icon: AtSign,
  },
  {
    label: "Workspace Name",
    href: "/settings/general#workspace-name",
    icon: Pencil,
    keywords: ["rename"],
  },
  {
    label: "Appearance",
    href: "/settings/account#appearance",
    icon: Palette,
    keywords: ["theme", "dark mode"],
  },
];

export const SETTINGS: CommandLink[] = [
  ...SETTINGS_TAB_LINKS,
  ...SETTINGS_ANCHORS,
];

export const HELP_SUPPORT_ACTION: CommandSheetAction = {
  label: HELP_SUPPORT.label,
  icon: HELP_SUPPORT.icon,
  keywords: HELP_SUPPORT.keywords,
  sheet: "support",
};

export const HELP_LINK_ITEMS: CommandLink[] = HELP_LINKS.map((link) => ({
  ...link,
  external: true,
}));

export function MONITOR_ACTIONS(id: number): CommandLink[] {
  return MONITOR_TABS.map((tab) => ({
    label: tab.label,
    href: `/monitors/${id}/${tab.value}`,
    icon: tab.icon,
  }));
}

export function STATUS_PAGE_ACTIONS(id: number): CommandLink[] {
  return STATUS_PAGE_TABS.map((tab) => ({
    label: tab.label,
    href: `/status-pages/${id}/${tab.value}`,
    icon: tab.icon,
  }));
}
