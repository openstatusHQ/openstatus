import type { IconType } from "@openstatus/icons";
import { FileText, Logs, Overview, Settings } from "@openstatus/icons";

export const MONITOR_TABS: {
  value: string;
  label: string;
  icon: IconType;
}[] = [
  { value: "overview", label: "Overview", icon: Overview },
  { value: "logs", label: "Logs", icon: Logs },
  { value: "report", label: "Report", icon: FileText },
  { value: "edit", label: "Settings", icon: Settings },
];
