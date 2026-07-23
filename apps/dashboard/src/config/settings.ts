import {
  Account,
  AuditLog,
  Billing,
  Globe,
  type IconType,
  Integrations,
  Settings,
} from "@openstatus/icons";

export type SettingsTab = {
  value: string;
  label: string;
  icon: IconType;
  href: string;
  keywords?: string[];
};

// Single source of truth for the settings tab bar and the command-menu
// "Settings" group so their icons stay in sync.
export const SETTINGS_TABS = [
  {
    value: "general",
    label: "General",
    icon: Settings,
    href: "/settings/general",
    keywords: ["workspace"],
  },
  {
    value: "account",
    label: "Account",
    icon: Account,
    href: "/settings/account",
    keywords: ["profile", "user"],
  },
  {
    value: "billing",
    label: "Billing",
    icon: Billing,
    href: "/settings/billing",
    keywords: ["plan", "subscription", "upgrade"],
  },
  {
    value: "integrations",
    label: "Integrations",
    icon: Integrations,
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
    icon: AuditLog,
    href: "/settings/audit-logs",
    keywords: ["activity", "history"],
  },
] satisfies SettingsTab[];
