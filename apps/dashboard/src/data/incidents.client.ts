import { Acknowledge, Check, Delete } from "@openstatus/icons";

import type { ActivityMark } from "@/components/content/activity";
import { levelFor } from "@/data/activity.client";

export const actions = [
  {
    id: "acknowledge",
    label: "Acknowledge",
    icon: Acknowledge,
    variant: "default" as const,
  },
  {
    id: "resolve",
    label: "Resolve",
    icon: Check,
    variant: "default" as const,
  },
  {
    id: "delete",
    label: "Delete",
    icon: Delete,
    variant: "destructive" as const,
  },
] as const;

export type IncidentAction = (typeof actions)[number];

export const getActions = (
  props: Partial<Record<IncidentAction["id"], () => Promise<void> | void>>,
): (IncidentAction & {
  onClick?: () => Promise<void> | void;
})[] => {
  return actions.map((action) => ({
    ...action,
    onClick: props[action.id as keyof typeof props],
  }));
};

const MINUTE = 60 * 1000;

export function downtimeSpan(incident: {
  startedAt: Date;
  resolvedAt: Date | null;
}) {
  return { start: incident.startedAt, end: incident.resolvedAt };
}

/** Calendar mark by time down: under 2m, 2 to 10m, over 10m. */
export function downtimeActivity(down: number): ActivityMark {
  return { scale: "failure", level: levelFor(down, [2 * MINUTE, 10 * MINUTE]) };
}
