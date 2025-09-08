"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { PanelTop } from "lucide-react";

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
