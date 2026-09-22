import type { StatusReportStatus } from "@openstatus/db/src/schema";
import type { PageComponentImpact } from "@openstatus/db/src/schema/page_components/constants";
import { Settings, Delete } from "@openstatus/icons";

import type { FormValues as StatusReportUpdateFormValues } from "@/components/forms/status-report-update/form";

export const impactConfig = {
  operational: {
    label: "Operational",
    color:
      "text-success/80 data-[state=selected]:bg-success/10 data-[state=selected]:text-success",
  },
  degraded_performance: {
    label: "Degraded performance",
    color:
      "text-warning/80 data-[state=selected]:bg-warning/10 data-[state=selected]:text-warning",
  },
  partial_outage: {
    label: "Partial outage",
    color:
      "text-warning/80 data-[state=selected]:bg-warning/10 data-[state=selected]:text-warning",
  },
  major_outage: {
    label: "Major outage",
    color:
      "text-destructive/80 data-[state=selected]:bg-destructive/10 data-[state=selected]:text-destructive",
  },
} as const satisfies Record<
  PageComponentImpact,
  { label: string; color: string }
>;

/** Set equality regardless of order — used to skip no-op impact writes. */
export function impactsEqual(
  a: { pageComponentId: number; impact: string }[],
  b: { pageComponentId: number; impact: string }[],
) {
  const key = (list: { pageComponentId: number; impact: string }[]) =>
    [...list]
      .sort((x, y) => x.pageComponentId - y.pageComponentId)
      .map((x) => `${x.pageComponentId}:${x.impact}`)
      .join(",");
  return key(a) === key(b);
}

// legacy report (created before impact tracking): no impact rows
export const untriagedImpact = {
  label: "Untriaged",
  color: "text-muted-foreground/80",
} as const;

export const actions = [
  {
    id: "edit",
    label: "Settings",
    icon: Settings,
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

export function defaultComponentImpacts({
  components,
  currentImpacts,
  nextStatus,
}: {
  components: { id: number }[];
  currentImpacts: Map<number, PageComponentImpact>;
  nextStatus: StatusReportStatus;
}): NonNullable<StatusReportUpdateFormValues["componentImpacts"]> {
  return components.map((c) => ({
    pageComponentId: c.id,
    impact:
      nextStatus === "resolved"
        ? "operational"
        : (currentImpacts.get(c.id) ?? "operational"),
  }));
}

// a legacy report stays legacy unless the operator actively sets a
// non-operational impact — never silently flip it green
export function toCreateStatusReportUpdateInput({
  statusReportId,
  values,
  reportHasImpacts,
}: {
  statusReportId: number;
  values: StatusReportUpdateFormValues;
  reportHasImpacts: boolean;
}) {
  const sendImpacts =
    reportHasImpacts ||
    values.componentImpacts?.some((ci) => ci.impact !== "operational");
  return {
    statusReportId,
    message: values.message,
    status: values.status,
    componentImpacts: sendImpacts ? values.componentImpacts : undefined,
    date: values.date,
    notifySubscribers: values.notifySubscribers,
  };
}
