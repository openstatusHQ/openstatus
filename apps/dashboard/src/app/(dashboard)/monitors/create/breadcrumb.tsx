"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { Activity } from "lucide-react";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Monitors",
          href: "/monitors",
          icon: Activity,
        },
        { type: "page", label: "Create Monitor" },
      ]}
    />
  );
}
