"use client";

import { Blocks, Cog, CreditCard, User } from "lucide-react";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        { type: "page", label: "Settings" },
        {
          type: "select",
          items: [
            { value: "general", label: "General", icon: Cog },
            { value: "account", label: "Account", icon: User },
            { value: "billing", label: "Billing", icon: CreditCard },
            { value: "integrations", label: "Integrations", icon: Blocks },
          ],
        },
      ]}
    />
  );
}
