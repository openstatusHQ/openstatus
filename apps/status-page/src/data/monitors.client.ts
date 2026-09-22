import { Code, Copy, Duplicate, Edit, Delete } from "@openstatus/icons";

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
    id: "clone",
    label: "Clone",
    icon: Duplicate,
    variant: "default" as const,
  },
  {
    id: "export",
    label: "Export Code",
    icon: Code,
    variant: "default" as const,
  },
  {
    id: "delete",
    label: "Delete",
    icon: Delete,
    variant: "destructive" as const,
  },
] as const;

export type MonitorAction = (typeof actions)[number];

export const getActions = (
  props: Partial<Record<MonitorAction["id"], () => Promise<void> | void>>,
): (MonitorAction & { onClick?: () => Promise<void> | void })[] => {
  return actions.map((action) => ({
    ...action,
    onClick: props[action.id as keyof typeof props],
  }));
};
