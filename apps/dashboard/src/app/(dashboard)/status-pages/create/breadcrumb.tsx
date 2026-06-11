"use client";

import { PanelTop } from "lucide-react";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Status Pages",
          href: "/status-pages",
          icon: PanelTop,
        },
        { type: "page", label: "Create Status Page" },
      ]}
    />
  );
}
