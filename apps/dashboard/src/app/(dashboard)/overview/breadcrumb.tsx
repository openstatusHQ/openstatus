"use client";

import { LayoutGrid } from "lucide-react";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[{ type: "page", label: "Overview", icon: LayoutGrid }]}
    />
  );
}
