"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { Bell } from "lucide-react";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[{ type: "page", label: "Notifications", icon: Bell }]}
    />
  );
}
