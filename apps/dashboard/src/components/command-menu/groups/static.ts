import { Billing, Dark, Light } from "@openstatus/icons";
import { ModelContextProtocolIcon, SlackIcon } from "@openstatus/icons/brand";
import {
  AtSign,
  KeyRound,
  Palette,
  PackagePlus,
  Pencil,
  Plus,
  UserRound,
  Users,
} from "lucide-react";

import { HELP_LINKS, HELP_SUPPORT } from "@/config/help";
import { NAV, NAV_MENU_ITEMS } from "@/config/nav";
import { SETTINGS_TABS } from "@/config/settings";

import type { CommandMenuGroup, CommandMenuItem } from "../types";

// Unlike the sidebar, Incidents sits right below Overview: the palette is for
// reaching the urgent thing fast.
export function navigationGroup(): CommandMenuGroup {
  const items = [
    ...NAV_MENU_ITEMS.slice(0, 1),
    NAV.incidents,
    ...NAV_MENU_ITEMS.slice(1),
  ];
  return {
    heading: "Navigation",
    items: items.map((item) => ({
      value: item.label,
      label: item.label,
      icon: item.icon,
      keywords: item.keywords,
      action: { type: "navigate", href: item.href },
    })),
  };
}

export function declareIncidentItem(): CommandMenuItem {
  return {
    value: "Declare Incident",
    label: "Declare Incident",
    icon: Plus,
    keywords: ["new incident", "outage", "commander", "severity"],
    action: { type: "sheet", sheet: { sheet: "declare-incident" } },
  };
}

export function createStatusReportItem(pageId?: number): CommandMenuItem {
  return {
    value: pageId ? "create-status-report" : "Create Status Report",
    label: "Create Status Report",
    icon: Plus,
    keywords: ["incident", "announce", "publish"],
    action: { type: "sheet", sheet: { sheet: "status-report", pageId } },
  };
}

export function createMaintenanceItem(pageId?: number): CommandMenuItem {
  return {
    value: pageId ? "create-maintenance" : "Create Maintenance",
    label: "Create Maintenance",
    icon: Plus,
    keywords: ["downtime", "window", "schedule"],
    action: { type: "sheet", sheet: { sheet: "maintenance", pageId } },
  };
}

type ReportRef = { id: number; title: string; status: string };

export function addStatusReportUpdateItem(report: ReportRef): CommandMenuItem {
  return {
    value: `add-update-${report.id}`,
    label: `Add Update to ${report.title}`,
    icon: Plus,
    keywords: ["update", "status report update", report.title],
    action: {
      type: "sheet",
      sheet: { sheet: "status-report-update", reportId: report.id },
    },
  };
}

export function statusReportItem(
  report: ReportRef & { pageId: number | null },
): CommandMenuItem {
  return {
    value: `status-report-${report.id}`,
    label: report.title,
    description: report.status,
    keywords: [report.title, report.status],
    action: {
      type: "navigate",
      href: `/status-pages/${report.pageId}/status-reports/${report.id}`,
    },
  };
}

export function createGroup(): CommandMenuGroup {
  return {
    heading: "Create",
    items: [
      declareIncidentItem(),
      {
        value: "Create Monitor",
        label: "Create Monitor",
        icon: Plus,
        keywords: ["new monitor"],
        action: { type: "navigate", href: "/monitors/create" },
      },
      {
        value: "Create Status Page",
        label: "Create Status Page",
        icon: Plus,
        keywords: ["new page"],
        action: { type: "navigate", href: "/status-pages/create" },
      },
      createStatusReportItem(),
      createMaintenanceItem(),
    ],
  };
}

// Deep-links into settings cards via anchor ids. Icons are only used here, so
// they live with the command menu rather than a shared config.
const SETTINGS_ANCHORS: CommandMenuItem[] = [
  {
    value: "API Keys",
    label: "API Keys",
    icon: KeyRound,
    keywords: ["token", "key"],
    action: { type: "navigate", href: "/settings/general#api-keys" },
  },
  {
    value: "Team Members",
    label: "Team Members",
    icon: Users,
    keywords: ["invite", "member"],
    action: { type: "navigate", href: "/settings/general#team-members" },
  },
  {
    value: "Workspace Slug",
    label: "Workspace Slug",
    icon: AtSign,
    action: { type: "navigate", href: "/settings/general#workspace-slug" },
  },
  {
    value: "Workspace Name",
    label: "Workspace Name",
    icon: Pencil,
    keywords: ["rename"],
    action: { type: "navigate", href: "/settings/general#workspace-name" },
  },
  {
    value: "Appearance",
    label: "Appearance",
    icon: Palette,
    keywords: ["theme", "dark mode"],
    action: { type: "navigate", href: "/settings/account#appearance" },
  },
  {
    value: "Personal Information",
    label: "Personal Information",
    icon: UserRound,
    keywords: ["profile", "name", "email"],
    action: {
      type: "navigate",
      href: "/settings/account#personal-information",
    },
  },
  {
    value: "Plans",
    label: "Plans",
    icon: Billing,
    keywords: ["upgrade", "pricing", "subscription"],
    action: { type: "navigate", href: "/settings/billing#plans" },
  },
  {
    value: "Add-ons",
    label: "Add-ons",
    icon: PackagePlus,
    keywords: ["addon", "extra", "limits"],
    action: { type: "navigate", href: "/settings/billing#add-ons" },
  },
  {
    value: "Slack Integration",
    label: "Slack Integration",
    icon: SlackIcon,
    keywords: ["slack", "agent"],
    action: { type: "navigate", href: "/settings/integrations#slack" },
  },
  {
    value: "Connected Apps",
    label: "Connected Apps",
    icon: ModelContextProtocolIcon,
    keywords: ["mcp", "oauth", "claude", "cursor"],
    action: { type: "navigate", href: "/settings/integrations#connected-apps" },
  },
];

export function settingsGroup(): CommandMenuGroup {
  return {
    heading: "Settings",
    items: [
      ...SETTINGS_TABS.map((tab) => ({
        value: tab.label,
        label: tab.label,
        icon: tab.icon,
        keywords: tab.keywords,
        action: { type: "navigate" as const, href: tab.href },
      })),
      ...SETTINGS_ANCHORS,
    ],
  };
}

export function helpGroup(): CommandMenuGroup {
  return {
    heading: "Get Help",
    items: [
      {
        value: HELP_SUPPORT.label,
        label: HELP_SUPPORT.label,
        icon: HELP_SUPPORT.icon,
        keywords: HELP_SUPPORT.keywords,
        action: { type: "sheet", sheet: { sheet: "support" } },
      },
      ...HELP_LINKS.map((link) => ({
        value: link.label,
        label: link.label,
        icon: link.icon,
        keywords: link.keywords,
        action: { type: "external" as const, href: link.href },
      })),
    ],
  };
}

export function themeGroup(
  resolvedTheme: string | undefined,
  setTheme: (t: string) => void,
): CommandMenuGroup {
  const target = resolvedTheme === "dark" ? "light" : "dark";
  return {
    heading: "Theme",
    items: [
      {
        value: "toggle-theme",
        label: `Switch to ${target} theme`,
        icon: resolvedTheme === "dark" ? Light : Dark,
        keywords: ["dark", "light", "appearance"],
        action: { type: "run", run: () => setTheme(target) },
      },
    ],
  };
}
