import type { LucideIcon } from "lucide-react";
import { Blocks, Cog, CreditCard, Globe, ScanEye, User } from "lucide-react";

export type SettingsTab = {
  value: string;
  label: string;
  icon: LucideIcon;
  href: string;
  keywords?: string[];
};

// Single source of truth for the settings tab bar and the command-menu
// "Settings" group so their icons stay in sync.
export const SETTINGS_TABS = [
  {
    value: "general",
    label: "General",
    icon: Cog,
    href: "/settings/general",
    keywords: ["workspace"],
  },
  {
    value: "account",
    label: "Account",
    icon: User,
    href: "/settings/account",
    keywords: ["profile", "user"],
  },
  {
    value: "billing",
    label: "Billing",
    icon: CreditCard,
    href: "/settings/billing",
    keywords: ["plan", "subscription", "upgrade"],
  },
  {
    value: "integrations",
    label: "Integrations",
    icon: Blocks,
    href: "/settings/integrations",
  },
  {
    value: "private-locations",
    label: "Private Locations",
    icon: Globe,
    href: "/settings/private-locations",
    keywords: ["probes", "regions"],
  },
  {
    value: "audit-logs",
    label: "Audit Logs",
    icon: ScanEye,
    href: "/settings/audit-logs",
    keywords: ["activity", "history"],
  },
] satisfies SettingsTab[];
