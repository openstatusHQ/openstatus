import { Delete } from "@openstatus/icons";

export const actions = [
  {
    id: "delete",
    label: "Delete",
    icon: Delete,
    variant: "destructive" as const,
  },
] as const;

export type PageComponentAction = (typeof actions)[number];

export const getActions = (
  props: Partial<Record<PageComponentAction["id"], () => Promise<void> | void>>,
): (PageComponentAction & { onClick?: () => Promise<void> | void })[] => {
  return actions.map((action) => ({
    ...action,
    onClick: props[action.id as keyof typeof props],
  }));
};
