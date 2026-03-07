import type { LucideIcon } from "lucide-react";
import { Cog, Hammer, LayoutTemplate, Megaphone, Users } from "lucide-react";

export const STATUS_PAGE_TABS: {
  value: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "status-reports", label: "Status Reports", icon: Megaphone },
  { value: "maintenances", label: "Maintenances", icon: Hammer },
  { value: "subscribers", label: "Subscribers", icon: Users },
  { value: "components", label: "Components", icon: LayoutTemplate },
  { value: "edit", label: "Settings", icon: Cog },
];
