import { StatusReportStatus } from "@openstatus/db/src/schema";
import { Pencil, Trash2 } from "lucide-react";

export const actions = [
  {
    id: "edit",
    label: "Edit",
    icon: Pencil,
    variant: "default" as const,
  },
  {
    id: "delete",
    label: "Delete",
    icon: Trash2,
    variant: "destructive" as const,
  },
] as const;

export type StatusReportUpdateAction = (typeof actions)[number];

export const getActions = (
  props: Partial<
    Record<StatusReportUpdateAction["id"], () => Promise<void> | void>
  >
): (StatusReportUpdateAction & { onClick?: () => Promise<void> | void })[] => {
  return actions.map((action) => ({
    ...action,
    onClick: props[action.id as keyof typeof props],
  }));
};

export const colors = {
  resolved:
    "text-success/80 data-[state=selected]:bg-success/10 data-[state=selected]:text-success",
  investigating:
    "text-destructive/80 data-[state=selected]:bg-destructive/10 data-[state=selected]:text-destructive",
  monitoring:
    "text-info/80 data-[state=selected]:bg-info/10 data-[state=selected]:text-info",
  identified:
    "text-warning/80 data-[state=selected]:bg-warning/10 data-[state=selected]:text-warning",
} as const satisfies Record<StatusReportStatus, string>;
