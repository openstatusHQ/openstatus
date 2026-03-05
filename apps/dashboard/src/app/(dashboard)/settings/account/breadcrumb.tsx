"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { Cog, User } from "lucide-react";

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
        { type: "page", label: "Account", icon: User },
      ]}
    />
  );
}
