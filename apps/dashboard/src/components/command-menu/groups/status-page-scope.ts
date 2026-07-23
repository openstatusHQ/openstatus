import type { RouterOutputs } from "@openstatus/api";
import { Plus } from "lucide-react";

import { STATUS_PAGE_TABS } from "@/app/(dashboard)/status-pages/[id]/constants";

import type { CommandMenuGroup, CommandMenuItem, CommandPage } from "../types";
import { createMaintenanceItem, createStatusReportItem } from "./static";

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
    ...unresolvedReports.map((report) => ({
      value: `add-update-${report.id}`,
      label: `Add Update to ${report.title}`,
      icon: Plus,
      keywords: ["update", "status report update", report.title],
      action: {
        type: "sheet" as const,
        sheet: { sheet: "status-report-update" as const, reportId: report.id },
      },
    })),
  ];

  return [
    { heading: "Actions", items: actionItems },
    {
      heading: "Status Reports",
      items: pageReports.map((report) => ({
        value: `status-report-${report.id}`,
        label: report.title,
        description: report.status,
        keywords: [report.title, report.status],
        action: {
          type: "navigate",
          href: `/status-pages/${page.id}/status-reports/${report.id}`,
        },
      })),
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
  ];
}
