import type { IconType } from "@openstatus/icons";
import { Alert, Calendar, Logs, Overview, Settings } from "@openstatus/icons";

export const MONITOR_TABS: {
  value: string;
  label: string;
  icon: IconType;
}[] = [
  { value: "overview", label: "Overview", icon: Overview },
  { value: "logs", label: "Logs", icon: Logs },
  { value: "history", label: "History", icon: Calendar },
  { value: "outages", label: "Outages", icon: Alert },
  { value: "edit", label: "Settings", icon: Settings },
];
