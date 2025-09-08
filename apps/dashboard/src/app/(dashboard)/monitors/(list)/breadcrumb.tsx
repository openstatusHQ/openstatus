"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { Activity } from "lucide-react";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[{ type: "page", label: "Monitors", icon: Activity }]}
    />
  );
}
