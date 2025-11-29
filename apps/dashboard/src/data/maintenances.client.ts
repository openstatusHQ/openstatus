import { Cog, Trash2 } from "lucide-react";

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

export type MaintenanceAction = (typeof actions)[number];

export const getActions = (
  props: Partial<Record<MaintenanceAction["id"], () => Promise<void> | void>>,
): (MaintenanceAction & { onClick?: () => Promise<void> | void })[] => {
  return actions.map((action) => ({
    ...action,
    onClick: props[action.id as keyof typeof props],
  }));
};
