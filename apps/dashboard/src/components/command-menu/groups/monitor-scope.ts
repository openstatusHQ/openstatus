import { Bell, Settings2, Tag, TriangleAlert } from "lucide-react";

import { MONITOR_TABS } from "@/app/(dashboard)/monitors/[id]/constants";

import type { CommandMenuGroup, CommandPage } from "../types";

// Cards every monitor type renders on the edit page.
export const MONITOR_EDIT_ANCHORS = [
  { id: "monitor-configuration", label: "Configuration", icon: Settings2 },
  { id: "tags", label: "Tags", icon: Tag },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "danger-zone", label: "Danger Zone", icon: TriangleAlert },
];

export function monitorScopeGroups(
  page: Extract<CommandPage, { type: "monitor" }>,
): CommandMenuGroup[] {
  return [
    {
      heading: page.name,
      key: "monitor",
      items: MONITOR_TABS.map((tab) => ({
        value: tab.label,
        label: tab.label,
        icon: tab.icon,
        action: { type: "navigate", href: `/monitors/${page.id}/${tab.value}` },
      })),
    },
    {
      // Not "Settings": the tab group above already has a Settings entry.
      heading: "Settings Sections",
      items: MONITOR_EDIT_ANCHORS.map((anchor) => ({
        value: `edit-${anchor.id}`,
        label: anchor.label,
        icon: anchor.icon,
        action: {
          type: "navigate",
          href: `/monitors/${page.id}/edit#${anchor.id}`,
        },
      })),
    },
  ];
}
