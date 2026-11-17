import type { RouterOutputs } from "@openstatus/api";
import {
  Clock,
  Globe,
  Languages,
  Link,
  Lock,
  Palette,
  Settings2,
  TriangleAlert,
} from "lucide-react";

import { STATUS_PAGE_TABS } from "@/app/(dashboard)/status-pages/[id]/constants";

import type { CommandMenuGroup, CommandMenuItem, CommandPage } from "../types";
import {
  addStatusReportUpdateItem,
  createMaintenanceItem,
  createStatusReportItem,
  statusReportItem,
} from "./static";

export const STATUS_PAGE_EDIT_ANCHORS = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "custom-domain", label: "Custom Domain", icon: Globe },
  { id: "links", label: "Links", icon: Link },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "locales", label: "Locales", icon: Languages },
  { id: "timezone", label: "Time Zone", icon: Clock },
  { id: "page-access", label: "Page Access", icon: Lock },
  { id: "danger-zone", label: "Danger Zone", icon: TriangleAlert },
];

type StatusReport = RouterOutputs["statusReport"]["list"][number];
type Maintenance = RouterOutputs["maintenance"]["list"][number];

export function statusPageScopeGroups({
  page,
  statusReports,
  maintenances,
}: {
  page: Extract<CommandPage, { type: "status-page" }>;
  statusReports: StatusReport[] | undefined;
  maintenances: Maintenance[] | undefined;
}): CommandMenuGroup[] {
  const pageReports = statusReports?.filter((r) => r.pageId === page.id) ?? [];
  const unresolvedReports = pageReports.filter((r) => r.status !== "resolved");
  const pageMaintenances =
    maintenances?.filter((m) => m.pageId === page.id) ?? [];

  const actionItems: CommandMenuItem[] = [
    createStatusReportItem(page.id),
    createMaintenanceItem(page.id),
    ...unresolvedReports.map(addStatusReportUpdateItem),
  ];

  return [
    { heading: "Actions", key: "actions", items: actionItems },
    {
      heading: "Status Reports",
      items: pageReports.map(statusReportItem),
    },
    {
      heading: "Maintenances",
      items: pageMaintenances.map((m) => ({
        value: `maintenance-${m.id}`,
        label: m.title,
        description: m.from.toLocaleString(),
        keywords: [m.title],
        action: {
          type: "navigate",
          href: `/status-pages/${page.id}/maintenances`,
        },
      })),
    },
    {
      heading: "Pages",
      key: "pages",
      items: STATUS_PAGE_TABS.map((tab) => ({
        value: tab.label,
        label: tab.label,
        icon: tab.icon,
        action: {
          type: "navigate",
          href: `/status-pages/${page.id}/${tab.value}`,
        },
      })),
    },
    {
      // Not "Settings": the tab group above already has a Settings entry.
      heading: "Settings Sections",
      key: "sections",
      items: STATUS_PAGE_EDIT_ANCHORS.map((anchor) => ({
        value: `edit-${anchor.id}`,
        label: anchor.label,
        icon: anchor.icon,
        action: {
          type: "navigate",
          href: `/status-pages/${page.id}/edit#${anchor.id}`,
        },
      })),
    },
  ];
}
