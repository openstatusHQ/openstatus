import type { IconType } from "@openstatus/icons";
import {
  Settings,
  Maintenance,
  Calendar,
  Components,
  Report,
  Team,
} from "@openstatus/icons";

export const STATUS_PAGE_TABS: {
  value: string;
  label: string;
  icon: IconType;
}[] = [
  { value: "status-reports", label: "Status Reports", icon: Report },
  { value: "maintenances", label: "Maintenances", icon: Maintenance },
  { value: "subscribers", label: "Subscribers", icon: Team },
  { value: "components", label: "Components", icon: Components },
  { value: "history", label: "History", icon: Calendar },
  { value: "edit", label: "Settings", icon: Settings },
];
