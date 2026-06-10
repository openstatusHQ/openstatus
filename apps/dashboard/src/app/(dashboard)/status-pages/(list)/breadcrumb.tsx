"use client";

import { PanelTop } from "lucide-react";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[{ type: "page", label: "Status Pages", icon: PanelTop }]}
    />
  );
}
