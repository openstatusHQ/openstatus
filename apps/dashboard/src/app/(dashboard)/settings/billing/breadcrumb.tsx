"use client";

import { Cog, CreditCard } from "@openstatus/icons";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

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
