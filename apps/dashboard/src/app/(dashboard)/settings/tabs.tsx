"use client";

import {
  Integrations,
  Settings,
  Billing,
  Globe,
  AuditLog,
  Account,
} from "@openstatus/icons";

import { NavTabs } from "@/components/nav/nav-tabs";

export function Tabs() {
  return (
    <NavTabs
      items={[
        {
          value: "general",
          label: "General",
          icon: Settings,
          href: "/settings/general",
        },
        {
          value: "account",
          label: "Account",
          icon: Account,
          href: "/settings/account",
        },
        {
          value: "billing",
          label: "Billing",
          icon: Billing,
          href: "/settings/billing",
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
        },
        {
          value: "audit-logs",
          label: "Audit Logs",
          icon: AuditLog,
          href: "/settings/audit-logs",
        },
      ]}
    />
  );
}
