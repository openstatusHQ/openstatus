"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { Cog } from "lucide-react";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        { type: "page", label: "Settings", icon: Cog },
        { type: "page", label: "General", icon: Cog },
      ]}
    />
  );
}
