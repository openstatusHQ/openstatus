import type { IconType } from "@openstatus/icons";
import { Overview, Settings } from "@openstatus/icons";

export const UPTIME_TARGET_TABS: {
  value: string;
  label: string;
  icon: IconType;
}[] = [
  { value: "overview", label: "Overview", icon: Overview },
  { value: "edit", label: "Settings", icon: Settings },
];
