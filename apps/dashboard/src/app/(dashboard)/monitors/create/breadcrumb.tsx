"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Monitors",
          href: "/dashboard/monitors",
        },
        { type: "page", label: "Create Monitor" },
      ]}
    />
  );
}
