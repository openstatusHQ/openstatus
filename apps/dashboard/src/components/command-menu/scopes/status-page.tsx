"use client";

import type { RouterOutputs } from "@openstatus/api";
import {
  CommandGroup,
  CommandItem,
} from "@openstatus/ui/components/ui/command";
import { Plus } from "lucide-react";

import { STATUS_PAGE_ACTIONS } from "../config";

type StatusReport = RouterOutputs["statusReport"]["list"][number];
type Maintenance = RouterOutputs["maintenance"]["list"][number];

export function StatusPageScope({
  page,
  statusReports,
  maintenances,
  navigate,
  onCreateStatusReport,
  onCreateMaintenance,
  onAddReportUpdate,
}: {
  page: { id: number; title: string };
  statusReports: StatusReport[] | undefined;
  maintenances: Maintenance[] | undefined;
  navigate: (href: string) => void;
  onCreateStatusReport: () => void;
  onCreateMaintenance: () => void;
  onAddReportUpdate: (reportId: number) => void;
}) {
  const pageReports = statusReports?.filter((r) => r.pageId === page.id) ?? [];
  const unresolvedReports = pageReports.filter((r) => r.status !== "resolved");
  const pageMaintenances =
    maintenances?.filter((m) => m.pageId === page.id) ?? [];

  return (
    <>
      <CommandGroup heading="Actions">
        <CommandItem
          value="create-status-report"
          keywords={["incident", "announce", "publish"]}
          onSelect={onCreateStatusReport}
        >
          <Plus />
          <span>Create Status Report</span>
        </CommandItem>
        <CommandItem
          value="create-maintenance"
          keywords={["downtime", "window", "schedule"]}
          onSelect={onCreateMaintenance}
        >
          <Plus />
          <span>Create Maintenance</span>
        </CommandItem>
        {unresolvedReports.map((report) => (
          <CommandItem
            key={`add-update-${report.id}`}
            value={`add-update-${report.id}`}
            keywords={["update", "status report update", report.title]}
            onSelect={() => onAddReportUpdate(report.id)}
          >
            <Plus />
            <span className="truncate">Add Update to {report.title}</span>
          </CommandItem>
        ))}
      </CommandGroup>

      {pageReports.length > 0 ? (
        <CommandGroup heading="Status Reports">
          {pageReports.map((report) => (
            <CommandItem
              key={report.id}
              value={`status-report-${report.id}`}
              keywords={[report.title, report.status]}
              onSelect={() =>
                navigate(`/status-pages/${page.id}/status-reports/${report.id}`)
              }
            >
              <div className="grid min-w-0">
                <span className="truncate">{report.title}</span>
                <span className="text-muted-foreground font-commit-mono truncate text-xs">
                  {report.status}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      {pageMaintenances.length > 0 ? (
        <CommandGroup heading="Maintenances">
          {pageMaintenances.map((m) => (
            <CommandItem
              key={m.id}
              value={`maintenance-${m.id}`}
              keywords={[m.title]}
              onSelect={() => navigate(`/status-pages/${page.id}/maintenances`)}
            >
              <div className="grid min-w-0">
                <span className="truncate">{m.title}</span>
                <span className="text-muted-foreground font-commit-mono truncate text-xs">
                  {m.from.toLocaleString()}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      <CommandGroup heading="Pages">
        {STATUS_PAGE_ACTIONS(page.id).map((item) => (
          <CommandItem
            key={item.href}
            value={item.label}
            keywords={item.keywords}
            onSelect={() => navigate(item.href)}
          >
            <item.icon />
            <span>{item.label}</span>
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}
