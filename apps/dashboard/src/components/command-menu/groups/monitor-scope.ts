import { MONITOR_TABS } from "@/app/(dashboard)/monitors/[id]/constants";

import type { CommandMenuGroup, CommandPage } from "../types";

export function monitorScopeGroups(
  page: Extract<CommandPage, { type: "monitor" }>,
): CommandMenuGroup[] {
  return [
    {
      heading: page.name,
      items: MONITOR_TABS.map((tab) => ({
        value: tab.label,
        label: tab.label,
        icon: tab.icon,
        action: { type: "navigate", href: `/monitors/${page.id}/${tab.value}` },
      })),
    },
  ];
}
