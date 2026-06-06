"use client";

import { NavTabs } from "@/components/nav/nav-tabs";
import { Blocks, Cog, CreditCard, Globe, ScanEye, User } from "lucide-react";

export function Tabs() {
  return (
    <NavTabs
      items={[
        {
          value: "general",
          label: "General",
          icon: Cog,
          href: "/settings/general",
        },
        {
          value: "account",
          label: "Account",
          icon: User,
          href: "/settings/account",
        },
        {
          value: "billing",
          label: "Billing",
          icon: CreditCard,
          href: "/settings/billing",
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
        },
        {
          value: "audit-logs",
          label: "Audit Logs",
          icon: ScanEye,
          href: "/settings/audit-logs",
        },
      ]}
    />
  );
}
