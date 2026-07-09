import {
  Settings,
  Copy,
  Duplicate,
  Globe,
  Network,
  Server,
  Delete,
} from "@openstatus/icons";

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
    label: "Settings",
    icon: Settings,
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
  // {
  //   id: "export",
  //   label: "Export Code",
  //   icon: Code,
  //   variant: "default" as const,
  // },
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
