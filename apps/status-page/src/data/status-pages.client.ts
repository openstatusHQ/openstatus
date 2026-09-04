import { Copy, Edit, Tag, Delete } from "@openstatus/icons";

export const actions = [
  {
    id: "edit",
    label: "Edit",
    icon: Edit,
    variant: "default" as const,
  },
  {
    id: "copy-id",
    label: "Copy ID",
    icon: Copy,
    variant: "default" as const,
  },
  {
    id: "create-badge",
    label: "Create Badge",
    icon: Tag,
    variant: "default" as const,
  },
  {
    id: "delete",
    label: "Delete",
    icon: Delete,
    variant: "destructive" as const,
  },
] as const;

export type StatusPageAction = (typeof actions)[number];

export const getActions = (
  props: Partial<Record<StatusPageAction["id"], () => Promise<void> | void>>,
): (StatusPageAction & { onClick?: () => Promise<void> | void })[] => {
  return actions.map((action) => ({
    ...action,
    onClick: props[action.id as keyof typeof props],
  }));
};
