"use client";

import { Monitor } from "@openstatus/icons";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Monitors",
          href: "/monitors",
          icon: Monitor,
        },
        { type: "page", label: "Create Monitor" },
      ]}
    />
  );
}
