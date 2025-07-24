import { Bookmark, Check, Trash2 } from "lucide-react";

export const actions = [
  {
    id: "acknowledge",
    label: "Acknowledge",
    icon: Bookmark,
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
    icon: Trash2,
    variant: "destructive" as const,
  },
] as const;

export type IncidentAction = (typeof actions)[number];

export const getActions = (
  props: Partial<Record<IncidentAction["id"], () => Promise<void> | void>>
): (IncidentAction & {
  onClick?: () => Promise<void> | void;
})[] => {
  return actions.map((action) => ({
    ...action,
    onClick: props[action.id as keyof typeof props],
  }));
};
