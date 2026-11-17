"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { NAV } from "@/config/nav";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        {
          type: "page",
          label: NAV.privateLocations.label,
          icon: NAV.privateLocations.icon,
        },
      ]}
    />
  );
}
