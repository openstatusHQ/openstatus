"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { Megaphone, Pencil, Hammer, Users } from "lucide-react";

// TODO: make it dynamic

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Status Pages",
          href: "/dashboard/status-pages",
        },
        { type: "page", label: "OpenStatus Status" },
        {
          type: "select",
          items: [
            { value: "edit", label: "Edit", icon: Pencil },
            {
              value: "status-reports",
              label: "Status Reports",
              icon: Megaphone,
            },
            { value: "maintenances", label: "Maintenances", icon: Hammer },
            { value: "subscribers", label: "Subscribers", icon: Users },
          ],
        },
      ]}
    />
  );
}
