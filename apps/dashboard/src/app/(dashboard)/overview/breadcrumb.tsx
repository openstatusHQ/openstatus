"use client";

import { LayoutGrid } from "@openstatus/icons";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[{ type: "page", label: "Overview", icon: LayoutGrid }]}
    />
  );
}
