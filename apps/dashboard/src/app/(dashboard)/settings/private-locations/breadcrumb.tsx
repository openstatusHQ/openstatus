"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { Cog, Globe } from "lucide-react";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Settings",
          icon: Cog,
          href: "/settings/general",
        },
        { type: "page", label: "Private Locations", icon: Globe },
      ]}
    />
  );
}
