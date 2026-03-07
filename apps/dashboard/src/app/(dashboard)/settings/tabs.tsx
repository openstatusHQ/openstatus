"use client";

import { NavTabs } from "@/components/nav/nav-tabs";
import { Blocks, Cog, CreditCard, User } from "lucide-react";

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
      ]}
    />
  );
}
