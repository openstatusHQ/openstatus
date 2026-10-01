import { Show, Delete } from "@openstatus/icons";

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
