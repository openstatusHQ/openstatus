"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { Cog, CreditCard } from "lucide-react";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Settings",
          icon: Cog,
          href: "/settings/general",
        },
        { type: "page", label: "Billing", icon: CreditCard },
      ]}
    />
  );
}
