import { Activity, LayoutDashboard, Link, Siren } from "lucide-react";
import type { Icon as LucideIcon, LucideProps } from "lucide-react";

export type Icon = LucideIcon;
export type ValidIcon = keyof typeof Icons;

export const Icons = {
  activity: Activity,
  "layout-dashboard": LayoutDashboard,
  link: Link,
  siren: Siren,
} as const;
