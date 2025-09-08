"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { PanelTop } from "lucide-react";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[{ type: "page", label: "Status Pages", icon: PanelTop }]}
    />
  );
}
