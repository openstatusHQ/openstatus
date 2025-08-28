import { Filter, Zap } from "lucide-react";

export const actions = [
  {
    id: "filter",
    label: "Filter",
    icon: Filter,
    variant: "default" as const,
  },
  {
    id: "trigger",
    label: "Trigger",
    icon: Zap,
    variant: "default" as const,
  },
] as const;

export type RegionMetricAction = (typeof actions)[number];

export const getActions = (
  props: Partial<Record<RegionMetricAction["id"], () => Promise<void> | void>>,
): (RegionMetricAction & { onClick?: () => Promise<void> | void })[] => {
  return actions.map((action) => ({
    ...action,
    onClick: props[action.id as keyof typeof props],
  }));
};
