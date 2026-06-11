import type { StatusReportStatus } from "@openstatus/db/src/schema";
import type { PageComponentImpact } from "@openstatus/db/src/schema/page_components/constants";
import { Cog, Trash2 } from "lucide-react";

export const impactConfig = {
  operational: {
    label: "Operational",
    color: "text-success/80 data-[state=selected]:bg-success/10 data-[state=selected]:text-success",
  },
  degraded_performance: {
    label: "Degraded performance",
    color: "text-warning/80 data-[state=selected]:bg-warning/10 data-[state=selected]:text-warning",
  },
  partial_outage: {
    label: "Partial outage",
    color: "text-warning/80 data-[state=selected]:bg-warning/10 data-[state=selected]:text-warning",
  },
  major_outage: {
    label: "Major outage",
    color: "text-destructive/80 data-[state=selected]:bg-destructive/10 data-[state=selected]:text-destructive",
  },
} as const satisfies Record<PageComponentImpact, { label: string; color: string }>;

// legacy report (created before impact tracking): no impact rows
export const untriagedImpact = {
  label: "Untriaged",
  color: "text-muted-foreground/80",
} as const;

export const actions = [
  {
    id: "edit",
    label: "Settings",
    icon: Cog,
    variant: "default" as const,
  },
  {
    id: "delete",
    label: "Delete",
    icon: Trash2,
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

export const colors = {
  resolved:
    "text-success/80 data-[state=selected]:bg-success/10 data-[state=selected]:text-success",
  investigating:
    "text-destructive/80 data-[state=selected]:bg-destructive/10 data-[state=selected]:text-destructive",
  monitoring:
    "text-info/80 data-[state=selected]:bg-info/10 data-[state=selected]:text-info",
  identified:
    "text-warning/80 data-[state=selected]:bg-warning/10 data-[state=selected]:text-warning",
} as const satisfies Record<StatusReportStatus, string>;

/**
 * Get the next status in the progression:
 * investigating → identified → monitoring → resolved
 *
 * @param currentStatus - The current status
 * @returns The next status in the progression, or 'resolved' if already at the end, or 'investigating' for invalid statuses
 */
export function getNextStatus(currentStatus: string): StatusReportStatus {
  const statusProgression: Record<StatusReportStatus, StatusReportStatus> = {
    investigating: "identified",
    identified: "monitoring",
    monitoring: "resolved",
    resolved: "resolved",
  };

  return (
    statusProgression[currentStatus as StatusReportStatus] ?? "investigating"
  );
}
