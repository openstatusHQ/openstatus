import {
  type PageComponentImpact,
  worstImpact,
} from "@openstatus/db/src/schema/page_components/constants";
import { Add, Check, Show, Delete } from "@openstatus/icons";

import { impactConfig } from "@/data/status-report-updates.client";

type StatusReportWithUpdates = {
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  updates: { date: Date }[];
};

/** Earliest update, else the row's creation. */
export function reportStartedAt(report: StatusReportWithUpdates): Date {
  const dates = report.updates.map((u) => u.date.getTime());
  if (dates.length) return new Date(Math.min(...dates));
  return report.createdAt ?? new Date(0);
}

/** Latest update once resolved; `null` while the report is open. */
export function reportResolvedAt(report: StatusReportWithUpdates): Date | null {
  if (report.status !== "resolved") return null;
  const dates = report.updates.map((u) => u.date.getTime());
  // legacy resolved report without updates: fall back to updatedAt
  if (!dates.length) return report.updatedAt ?? report.createdAt;
  return new Date(Math.max(...dates));
}

export const actions = [
  {
    id: "add-update",
    label: "Add update",
    icon: Add,
    variant: "default" as const,
  },
  {
    id: "resolve",
    label: "Resolve",
    icon: Check,
    variant: "default" as const,
  },
  {
    id: "view-report",
    label: "View Report",
    icon: Show,
    variant: "default" as const,
  },
  {
    id: "delete",
    label: "Delete",
    icon: Delete,
    variant: "destructive" as const,
  },
] as const;

export type StatusReportUpdateAction = (typeof actions)[number];

export const getActions = (
  props: Partial<
    Record<StatusReportUpdateAction["id"], () => Promise<void> | void>
  >,
): (StatusReportUpdateAction & { onClick?: () => Promise<void> | void })[] => {
  return actions.map((action) => ({
    ...action,
    onClick: props[action.id as keyof typeof props],
  }));
};

type ReportWithImpacts = {
  pageComponents: unknown[];
  updates: { componentImpacts: { impact: PageComponentImpact }[] }[];
};

/** Worst impact ever set (resolved reads operational otherwise); `null` = legacy, no impact rows; `undefined` = nothing affected. */
export function worstReportImpact(
  report: ReportWithImpacts,
): PageComponentImpact | null | undefined {
  if (report.pageComponents.length === 0) return undefined;
  const impacts = report.updates.flatMap((u) =>
    u.componentImpacts.map((ci) => ci.impact),
  );
  if (impacts.length === 0) return null;
  return worstImpact(impacts);
}

export const impactLevels = {
  operational: 0,
  degraded_performance: 1,
  partial_outage: 2,
  major_outage: 3,
} as const satisfies Record<PageComponentImpact, 0 | 1 | 2 | 3>;

export function reportSpan(report: StatusReportWithUpdates) {
  const start = reportStartedAt(report);
  // undated legacy report: an empty span, not one open since 1970
  if (start.getTime() === 0) return { start, end: start };
  return { start, end: reportResolvedAt(report) };
}

/** Calendar mark by worst impact; no components (or all operational) stays a neutral grey. */
export function reportActivity(report: ReportWithImpacts) {
  const impact = worstReportImpact(report);
  // green has no place in an incident calendar
  if (!impact || impact === "operational")
    return { variant: "default", level: 1 } as const;
  return {
    variant: impactConfig[impact].variant,
    level: Math.max(1, impactLevels[impact]) as 1 | 2 | 3,
  };
}
