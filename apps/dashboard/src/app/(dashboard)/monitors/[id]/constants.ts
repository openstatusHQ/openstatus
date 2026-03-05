import type { LucideIcon } from "lucide-react";
import { Cog, LayoutGrid, Logs, Siren } from "lucide-react";

export const MONITOR_TABS: {
  value: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "overview", label: "Overview", icon: LayoutGrid },
  { value: "logs", label: "Logs", icon: Logs },
  { value: "incidents", label: "Incidents", icon: Siren },
  { value: "edit", label: "Settings", icon: Cog },
];
