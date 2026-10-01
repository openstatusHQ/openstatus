import { Show, Delete } from "@openstatus/icons";

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
