import type { monitorStatus } from "@openstatus/db/src/schema/monitors/constants";
import {
  Api,
  Settings,
  Copy,
  Duplicate,
  Globe,
  Network,
  Pause,
  Play,
  Schedule,
  Speed,
  Server,
  Terminal,
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
  {
    id: "icmp",
    label: "ICMP",
    icon: Speed,
  },
  {
    id: "grpc",
    label: "gRPC",
    icon: Api,
  },
  {
    id: "heartbeat",
    label: "Heartbeat",
    icon: Schedule,
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
    id: "copy-curl",
    label: "Copy cURL",
    icon: Terminal,
    variant: "default" as const,
  },
  {
    id: "clone",
    label: "Clone",
    icon: Duplicate,
    variant: "default" as const,
  },
  // mutually exclusive: callers keep the one matching `monitor.active`
  {
    id: "pause",
    label: "Pause",
    icon: Pause,
    variant: "default" as const,
  },
  {
    id: "resume",
    label: "Resume",
    icon: Play,
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

type MonitorStatus = (typeof monitorStatus)[number];

export const monitorHealthConfig = {
  inactive: { label: "Inactive" },
  active: { label: "Normal" },
  degraded: { label: "Degraded" },
  error: { label: "Failing" },
} as const satisfies Record<MonitorStatus | "inactive", { label: string }>;

export type MonitorHealth = keyof typeof monitorHealthConfig;

/** A paused monitor reads as inactive whatever its last check said. */
export function getMonitorHealth(monitor: {
  active: boolean | null;
  status: MonitorStatus;
}): MonitorHealth {
  return monitor.active ? monitor.status : "inactive";
}
