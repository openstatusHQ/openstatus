import type { IconType } from "@openstatus/icons";
import {
  CloudOff,
  Logs,
  Maintenance,
  Overview,
  Settings,
} from "@openstatus/icons";

export const MONITOR_TABS: {
  value: string;
  label: string;
  icon: IconType;
}[] = [
  { value: "overview", label: "Overview", icon: Overview },
  { value: "logs", label: "Logs", icon: Logs },
  { value: "incidents", label: "Downtime", icon: CloudOff },
  { value: "maintenance", label: "Maintenance", icon: Maintenance },
  // TODO: hidden in the tabs but still accessible via direct link - can be enabled in the future
  // { value: "uptime", label: "Uptime", icon: Success },
  { value: "edit", label: "Settings", icon: Settings },
];
