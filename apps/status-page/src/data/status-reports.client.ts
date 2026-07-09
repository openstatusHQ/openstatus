import { Edit, Add, Delete } from "@openstatus/icons";

export const actions = [
  {
    id: "edit",
    label: "Edit",
    icon: Edit,
    variant: "default" as const,
  },
  {
    id: "create-update",
    label: "Create Update",
    icon: Add,
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
