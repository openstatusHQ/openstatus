import type { RouterOutputs } from "@openstatus/api";
import { Settings, Delete } from "@openstatus/icons";

import type { ActivityMark } from "@/components/content/activity";
import { levelFor } from "@/data/activity.client";

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

type Maintenance = NonNullable<RouterOutputs["maintenance"]["get"]>;

/** `maintenance.update` requires every field: start from the current row. */
export function toUpdateInput(maintenance: Maintenance) {
  return {
    id: maintenance.id,
    title: maintenance.title,
    startDate: maintenance.from,
    endDate: maintenance.to,
    pageComponents: maintenance.pageComponentIds,
  };
}

const HOUR = 60 * 60 * 1000;

export function maintenanceSpan(maintenance: { from: Date; to: Date }) {
  return { start: maintenance.from, end: maintenance.to };
}

/** Calendar mark by planned time: under 1h, 1 to 4h, over 4h. */
export function maintenanceActivity(planned: number): ActivityMark {
  return { scale: "planned", level: levelFor(planned, [HOUR, 4 * HOUR]) };
}
