"use client";

import { Activity } from "lucide-react";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

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
