"use client";

import { Settings, Billing } from "@openstatus/icons";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Settings",
          icon: Settings,
          href: "/settings/general",
        },
        { type: "page", label: "Billing", icon: Billing },
      ]}
    />
  );
}
