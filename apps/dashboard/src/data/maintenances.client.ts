import { Settings, Delete } from "@openstatus/icons";

import type { StatusVariant } from "@/components/common/status-dot";
import type { MaintenanceStatus } from "@/data/overview-events.client";

export const maintenanceStatusVariants = {
  scheduled: "info",
  "in-progress": "warning",
  completed: "success",
} as const satisfies Record<MaintenanceStatus, StatusVariant>;

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

export type MaintenanceAction = (typeof actions)[number];

export const getActions = (
  props: Partial<Record<MaintenanceAction["id"], () => Promise<void> | void>>,
): (MaintenanceAction & { onClick?: () => Promise<void> | void })[] => {
  return actions.map((action) => ({
    ...action,
    onClick: props[action.id as keyof typeof props],
  }));
};
