import { Acknowledge, Check, Delete } from "@openstatus/icons";

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

/** Calendar mark: red by how long the monitor was down. */
export function downtimeActivity(
  incident: { startedAt: Date; resolvedAt: Date | null },
  now = new Date(),
) {
  const length =
    (incident.resolvedAt ?? now).getTime() - incident.startedAt.getTime();
  return {
    variant: "destructive",
    level: levelFor(length, [15 * MINUTE, 2 * 60 * MINUTE]),
  } as const;
}
