import {
  Copy,
  CopyPlus,
  Globe,
  Network,
  Pencil,
  Server,
  Trash2,
} from "lucide-react";

export const monitorTypes = [
  {
    id: "http",
    label: "HTTP",
    icon: Globe,
  },
  {
    id: "tcp",
    label: "TCP",
    icon: Network,
  },
  {
    id: "dns",
    label: "DNS",
    icon: Server,
  },
] as const;

export const actions = [
  {
    id: "edit",
    label: "Edit",
    icon: Pencil,
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
    icon: CopyPlus,
    variant: "default" as const,
  },
  // {
  //   id: "export",
  //   label: "Export Code",
  //   icon: Code,
  //   variant: "default" as const,
  // },
  {
    id: "delete",
    label: "Delete",
    icon: Trash2,
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
